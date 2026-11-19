import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { ChatService } from '../chat/chat.service.js';
import { DiscoveryService } from '../discovery/discovery.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ageOn, toCalendarDate, todayInTurkey } from '../users/age.js';
import type { LikeResultDto, MatchDetailDto, MatchSummaryDto } from './dto/matching.dto.js';

/** "Geç" denen kişi bu süre sonra yeniden gösterilebilir (açık karar #4, öneri: 30 gün). */
export const PASS_TTL_DAYS = 30;
const PAGE_SIZE = 20;

/** Eşleşme çifti her zaman sıralıdır (DB'de CHECK userAId < userBId). */
export function orderedPair(a: string, b: string): { userAId: string; userBId: string } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

const notFound = () =>
  new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Kişi bulunamadı');

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly storage: StorageService,
    private readonly chat: ChatService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Beğeni. Karşı taraf da beğenmişse eşleşme oluşur.
   * - Yalnızca görüntüleyene keşfette gösterilebilecek kişiler beğenilebilir (aksi halde 404).
   * - İdempotent: aynı kişiyi tekrar beğenmek yeni kayıt oluşturmaz.
   * - Eşzamanlı karşılıklı beğenide tek eşleşme: çift için advisory lock + unique kısıt.
   * - Bitmiş (UNMATCHED) bir eşleşme yeniden açılmaz.
   */
  async like(viewerId: string, targetId: string): Promise<LikeResultDto> {
    if (viewerId === targetId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.CANNOT_TARGET_SELF,
        'Kendini beğenemezsin',
      );
    }
    const viewer = await this.discovery.requireViewer(viewerId);
    if (!(await this.discovery.isVisibleTo(viewer, targetId))) throw notFound();

    const pair = orderedPair(viewerId, targetId);
    const result = await this.prisma.$transaction(
      async (tx): Promise<LikeResultDto & { created?: boolean }> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`match:${pair.userAId}:${pair.userBId}`}, 0))`;

        await tx.like.upsert({
          where: { actorId_targetId: { actorId: viewerId, targetId } },
          create: { actorId: viewerId, targetId },
          update: {},
        });
        await tx.pass.deleteMany({ where: { actorId: viewerId, targetId } });

        const existing = await tx.match.findUnique({ where: { userAId_userBId: pair } });
        if (existing) {
          if (existing.status !== 'ACTIVE')
            return { matched: false, matchId: null, conversationId: null };
          const conversation = await tx.conversation.findUnique({
            where: { matchId: existing.id },
            select: { id: true },
          });
          return { matched: true, matchId: existing.id, conversationId: conversation?.id ?? null };
        }

        const reciprocal = await tx.like.findUnique({
          where: { actorId_targetId: { actorId: targetId, targetId: viewerId } },
        });
        if (!reciprocal) return { matched: false, matchId: null, conversationId: null };

        const match = await tx.match.create({ data: pair });
        const conversationId = await this.chat.openForMatch(tx, match.id, [
          pair.userAId,
          pair.userBId,
        ]);
        return { matched: true, matchId: match.id, conversationId, created: true };
      },
    );

    const { created, ...response } = result;
    if (created && response.matchId) {
      // İşlem tamamlandıktan sonra: iki tarafa canlı olay, çevrimdışı olan karşı tarafa push.
      this.realtime.emitToUsers([viewerId, targetId], RealtimeEvent.MATCH_NEW, {
        matchId: response.matchId,
        conversationId: response.conversationId,
      });
      await this.notifications.notify({
        userId: targetId,
        kind: 'NEW_MATCH',
        matchId: response.matchId,
        conversationId: response.conversationId ?? undefined,
      });
    }
    return response;
  }

  async pass(viewerId: string, targetId: string): Promise<void> {
    if (viewerId === targetId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.CANNOT_TARGET_SELF,
        'Kendini geçemezsin',
      );
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) throw notFound();
    const expiresAt = new Date(Date.now() + PASS_TTL_DAYS * 86_400_000);
    await this.prisma.pass.upsert({
      where: { actorId_targetId: { actorId: viewerId, targetId } },
      create: { actorId: viewerId, targetId, expiresAt },
      update: { expiresAt },
    });
  }

  /** Aktif eşleşmeler, en yeni önce. Karşı taraf aktif değilse veya engel varsa gösterilmez. */
  async list(
    viewerId: string,
    cursor?: string,
  ): Promise<{ items: MatchSummaryDto[]; nextCursor: string | null }> {
    const after = decodeCursor(cursor);
    const visibleOther = {
      status: 'ACTIVE' as const,
      blocksGiven: { none: { blockedId: viewerId } },
      blocksReceived: { none: { blockerId: viewerId } },
    };
    const rows = await this.prisma.match.findMany({
      where: {
        AND: [
          { status: 'ACTIVE' },
          {
            OR: [
              { userAId: viewerId, userB: visibleOther },
              { userBId: viewerId, userA: visibleOther },
            ],
          },
          ...(after
            ? [
                {
                  OR: [
                    { createdAt: { lt: after.createdAt } },
                    { createdAt: after.createdAt, id: { lt: after.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
      select: { id: true, createdAt: true, userAId: true, userBId: true },
    });
    const items = rows.slice(0, PAGE_SIZE);
    const last = items[items.length - 1];
    return {
      items: await this.summaries(viewerId, items),
      nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async detail(viewerId: string, matchId: string): Promise<MatchDetailDto> {
    const match = await this.findActive(viewerId, matchId);
    const otherId = match.userAId === viewerId ? match.userBId : match.userAId;
    const profile = await this.discovery.matchCard(viewerId, otherId);
    if (!profile) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Eşleşme bulunamadı');
    }
    const conversation = await this.prisma.conversation.findUnique({
      where: { matchId: match.id },
      select: { id: true },
    });
    return {
      matchId: match.id,
      matchedAt: match.createdAt,
      conversationId: conversation?.id ?? null,
      profile,
    };
  }

  /** Eşleşmeyi bitirir; sohbet iki taraf için de kapanır (mesajlar şikayet kanıtı için silinmez). */
  async unmatch(viewerId: string, matchId: string): Promise<void> {
    const match = await this.findActive(viewerId, matchId);
    const conversationId = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.match.updateMany({
        where: { id: match.id, status: 'ACTIVE' },
        data: { status: 'UNMATCHED', unmatchedById: viewerId, unmatchedAt: new Date() },
      });
      if (count === 0) {
        throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Eşleşme bulunamadı');
      }
      return this.chat.closeForMatch(tx, match.id);
    });
    if (conversationId) this.chat.emitClosed(conversationId, [match.userAId, match.userBId]);
  }

  private async findActive(viewerId: string, matchId: string) {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, status: 'ACTIVE', OR: [{ userAId: viewerId }, { userBId: viewerId }] },
    });
    // Başkasının eşleşmesi için de 404: varlığı sızdırılmaz.
    if (!match)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Eşleşme bulunamadı');
    return match;
  }

  private async summaries(
    viewerId: string,
    rows: { id: string; createdAt: Date; userAId: string; userBId: string }[],
  ): Promise<MatchSummaryDto[]> {
    const others = rows.map((r) => (r.userAId === viewerId ? r.userBId : r.userAId));
    const users = await this.prisma.user.findMany({
      where: { id: { in: others } },
      select: {
        id: true,
        birthDate: true,
        profile: { select: { displayName: true } },
        photos: {
          where: { status: 'APPROVED' },
          orderBy: { position: 'asc' },
          take: 1,
          select: { storageKey: true },
        },
      },
    });
    const today = todayInTurkey();
    return Promise.all(
      rows.map(async (row) => {
        const otherId = row.userAId === viewerId ? row.userBId : row.userAId;
        const user = users.find((u) => u.id === otherId);
        const photo = user?.photos[0];
        return {
          matchId: row.id,
          matchedAt: row.createdAt,
          user: {
            userId: otherId,
            displayName: user?.profile?.displayName ?? '',
            age: user?.birthDate ? ageOn(toCalendarDate(user.birthDate), today) : 0,
            photoUrl: photo ? await this.storage.presignDownload(photo.storageKey, 600) : null,
          },
        };
      }),
    );
  }
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor?: string): { createdAt: Date; id: string } | undefined {
  if (!cursor) return undefined;
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const createdAt = new Date(iso ?? '');
  if (!id || Number.isNaN(createdAt.getTime()) || !/^[0-9a-f-]{36}$/.test(id)) {
    throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, 'Geçersiz sayfa imleci');
  }
  return { createdAt, id };
}
