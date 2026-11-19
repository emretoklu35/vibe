import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type {
  CommunicationStyle,
  Frequency,
  RelationshipGoal,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { ConsentsService } from '../privacy/consents.service.js';
import { ageOn, formatCalendarDate, toCalendarDate, todayInTurkey } from '../users/age.js';
import {
  type CandidateRow,
  DiscoveryRepository,
  type ViewerFilter,
} from './discovery.repository.js';
import {
  DiscoveryRequirement,
  type DiscoveryStatusDto,
  type ProfileCardDto,
} from './dto/discovery.dto.js';
import { compatibility, distanceLabel, type ScoringProfile } from './scoring.js';

const PHOTO_URL_TTL_SECONDS = 10 * 60;
const ACTIVITY_TOUCH_MS = 5 * 60 * 1000;

type Viewer = { filter: ViewerFilter; scoring: ScoringProfile };

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: DiscoveryRepository,
    private readonly storage: StorageService,
    private readonly consents: ConsentsService,
  ) {}

  async status(viewerId: string): Promise<DiscoveryStatusDto> {
    const { missing } = await this.loadViewer(viewerId);
    return { ready: missing.length === 0, missing };
  }

  /** Keşfet için hazır değilse 409 DISCOVERY_NOT_READY (eksikler ayrıntıda). */
  async requireViewer(viewerId: string): Promise<Viewer> {
    const { viewer, missing } = await this.loadViewer(viewerId);
    if (!viewer || missing.length > 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.DISCOVERY_NOT_READY,
        'Keşfeti kullanmak için profilini tamamla',
        { missing },
      );
    }
    return viewer;
  }

  async candidates(viewerId: string, limit: number): Promise<ProfileCardDto[]> {
    const viewer = await this.requireViewer(viewerId);
    await this.touchActivity(viewerId);
    const pool = await this.repository.findCandidates(viewer.filter, { excludeActedOn: true });
    const cards = await this.buildCards(viewer, pool);
    return cards
      .sort(
        (a, b) =>
          b.card.compatibility.score - a.card.compatibility.score || a.distance - b.distance,
      )
      .slice(0, limit)
      .map((c) => c.card);
  }

  /**
   * Hedef kişi şu an görüntüleyene keşfette gösterilebilir mi (beğeni/geç geçmişi hariç)?
   * Beğeni gibi işlemler yalnızca görünür kişilere yapılabilir: rastgele kimliklerle toplu
   * beğeni/tarama engellenir.
   */
  async isVisibleTo(viewer: Viewer, targetId: string): Promise<boolean> {
    const rows = await this.repository.findCandidates(viewer.filter, {
      onlyUserId: targetId,
      excludeActedOn: false,
    });
    return rows.length === 1;
  }

  /**
   * Eşleşilen kişinin kartı (mesafe ve uyum dahil). Keşfet filtrelerinden bağımsızdır: karşı taraf
   * sonradan tercihini değiştirse ya da keşfette gizlense de eşleşme görünümü bozulmaz.
   * Hesap aktif değilse veya engel varsa undefined.
   */
  async matchCard(viewerId: string, targetId: string): Promise<ProfileCardDto | undefined> {
    const { viewer } = await this.loadViewer(viewerId);
    if (!viewer) return undefined;
    const row = await this.repository.findProfileRow(viewerId, targetId, viewer.filter.today);
    if (!row) return undefined;
    const [card] = await this.buildCards(viewer, [row]);
    return card?.card;
  }

  private async loadViewer(
    viewerId: string,
  ): Promise<{ viewer?: Viewer; missing: DiscoveryRequirement[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: viewerId },
      select: {
        birthDate: true,
        verificationRequired: true,
        moderationHold: true,
        profile: true,
        preference: true,
        interests: { select: { interest: { select: { id: true, labelTr: true } } } },
        _count: { select: { photos: { where: { status: 'APPROVED' } } } },
      },
    });
    const { profile, preference } = user;
    const consent = await this.consents.isGranted(viewerId, 'SPECIAL_CATEGORY_ORIENTATION');

    const missing: DiscoveryRequirement[] = [];
    if (!profile) missing.push(DiscoveryRequirement.PROFILE);
    if (user._count.photos === 0) missing.push(DiscoveryRequirement.APPROVED_PHOTO);
    if (!profile?.locationUpdatedAt) missing.push(DiscoveryRequirement.LOCATION);
    if (!consent) missing.push(DiscoveryRequirement.ORIENTATION_CONSENT);
    else if (!preference || preference.seekingGenders.length === 0) {
      missing.push(DiscoveryRequirement.SEEKING_GENDERS);
    }
    if (profile && !profile.isDiscoverable) missing.push(DiscoveryRequirement.VISIBLE);
    if (user.verificationRequired) missing.push(DiscoveryRequirement.VERIFICATION);
    if (user.moderationHold) missing.push(DiscoveryRequirement.UNDER_REVIEW);

    if (!profile || !preference || !user.birthDate) return { missing };
    const today = todayInTurkey();
    return {
      missing,
      viewer: {
        filter: {
          viewerId,
          gender: profile.gender,
          age: ageOn(toCalendarDate(user.birthDate), today),
          seekingGenders: preference.seekingGenders,
          minAge: preference.minAge,
          maxAge: preference.maxAge,
          maxDistanceKm: preference.maxDistanceKm,
          today: formatCalendarDate(today),
        },
        scoring: {
          interests: user.interests.map((i) => ({ id: i.interest.id, label: i.interest.labelTr })),
          relationshipGoal: profile.relationshipGoal,
          smoking: profile.smoking,
          drinking: profile.drinking,
          exercise: profile.exercise,
          wantsChildren: profile.wantsChildren,
          communicationStyle: profile.communicationStyle,
        },
      },
    };
  }

  private async buildCards(viewer: Viewer, rows: CandidateRow[]) {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.userId);
    const [interests, photos] = await Promise.all([
      this.prisma.userInterest.findMany({
        where: { userId: { in: ids } },
        select: {
          userId: true,
          interest: { select: { id: true, slug: true, category: true, labelTr: true } },
        },
      }),
      this.prisma.profilePhoto.findMany({
        where: { userId: { in: ids }, status: 'APPROVED' },
        orderBy: { position: 'asc' },
        select: { id: true, userId: true, storageKey: true, width: true, height: true },
      }),
    ]);

    return Promise.all(
      rows.map(async (row) => {
        const own = interests.filter((i) => i.userId === row.userId).map((i) => i.interest);
        const distanceKm = row.distanceMeters / 1000;
        const result = compatibility(
          viewer.scoring,
          {
            interests: own.map((i) => ({ id: i.id, label: i.labelTr })),
            relationshipGoal: row.relationshipGoal,
            smoking: row.smoking,
            drinking: row.drinking,
            exercise: row.exercise,
            wantsChildren: row.wantsChildren,
            communicationStyle: row.communicationStyle,
          },
          {
            distanceKm,
            maxDistanceKm: viewer.filter.maxDistanceKm,
            daysSinceActive: (Date.now() - row.lastActiveAt.getTime()) / 86_400_000,
          },
        );
        const card: ProfileCardDto = {
          userId: row.userId,
          displayName: row.displayName,
          age: row.age,
          gender: row.gender,
          verified: row.verified,
          cityName: row.cityName,
          distanceLabel: distanceLabel(distanceKm),
          bio: row.bio,
          jobTitle: row.jobTitle,
          heightCm: row.heightCm,
          relationshipGoal: row.relationshipGoal as RelationshipGoal | null,
          smoking: row.smoking as Frequency | null,
          drinking: row.drinking as Frequency | null,
          exercise: row.exercise as Frequency | null,
          wantsChildren: row.wantsChildren,
          communicationStyle: row.communicationStyle as CommunicationStyle | null,
          interests: own.map((i) => ({
            id: i.id,
            slug: i.slug,
            category: i.category,
            label: i.labelTr,
          })),
          photos: await Promise.all(
            photos
              .filter((p) => p.userId === row.userId)
              .map(async (p) => ({
                id: p.id,
                url: await this.storage.presignDownload(p.storageKey, PHOTO_URL_TTL_SECONDS),
                width: p.width,
                height: p.height,
              })),
          ),
          compatibility: result,
        };
        return { card, distance: distanceKm };
      }),
    );
  }

  /** Son aktiflik (puanlamada kullanılır) en fazla 5 dakikada bir yazılır. */
  private async touchActivity(userId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, lastActiveAt: { lt: new Date(Date.now() - ACTIVITY_TOUCH_MS) } },
      data: { lastActiveAt: new Date() },
    });
  }
}
