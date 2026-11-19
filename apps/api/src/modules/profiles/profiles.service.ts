import { hkdfSync } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ConsentsService } from '../privacy/consents.service.js';
import type {
  InterestDto,
  MyProfileDto,
  ProfileDto,
  UpdateLocationDto,
  UpsertProfileDto,
} from './dto/profile.dto.js';
import type { PreferenceDto, SetPreferencesDto } from './dto/preferences.dto.js';
import { fuzzLocation } from './location-fuzz.js';

const PROFILE_SELECT = {
  displayName: true,
  gender: true,
  bio: true,
  jobTitle: true,
  heightCm: true,
  relationshipGoal: true,
  smoking: true,
  drinking: true,
  exercise: true,
  wantsChildren: true,
  communicationStyle: true,
  cityName: true,
  isDiscoverable: true,
  locationUpdatedAt: true,
} as const;

/** Yeni bir kullanıcının ilk keşfet tercihleri (kullanıcı değiştirebilir). */
export const DEFAULT_PREFERENCE = { minAge: 18, maxAge: 60, maxDistanceKm: 50 } as const;

@Injectable()
export class ProfilesService {
  private readonly locationSecret: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly consents: ConsentsService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.locationSecret = Buffer.from(
      hkdfSync('sha256', config.PHONE_HMAC_KEY, Buffer.alloc(0), 'vibe:location:v1', 32),
    );
  }

  async getMine(userId: string): Promise<MyProfileDto> {
    const [profile, interests] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: PROFILE_SELECT }),
      this.prisma.userInterest.findMany({
        where: { userId },
        include: { interest: true },
        orderBy: { interest: { labelTr: 'asc' } },
      }),
    ]);
    return { profile, interests: interests.map((i) => toInterestDto(i.interest)) };
  }

  async upsert(userId: string, input: UpsertProfileDto): Promise<ProfileDto> {
    const data = {
      displayName: input.displayName,
      gender: input.gender,
      bio: input.bio,
      jobTitle: input.jobTitle,
      heightCm: input.heightCm,
      relationshipGoal: input.relationshipGoal,
      smoking: input.smoking,
      drinking: input.drinking,
      exercise: input.exercise,
      wantsChildren: input.wantsChildren,
      communicationStyle: input.communicationStyle,
      cityName: input.cityName,
      isDiscoverable: input.isDiscoverable,
    };
    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: PROFILE_SELECT,
    });
  }

  async listInterests(): Promise<InterestDto[]> {
    const rows = await this.prisma.interest.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { labelTr: 'asc' }],
    });
    return rows.map(toInterestDto);
  }

  async setInterests(userId: string, interestIds: number[]): Promise<InterestDto[]> {
    const valid = await this.prisma.interest.findMany({
      where: { id: { in: interestIds }, isActive: true },
      select: { id: true },
    });
    if (valid.length !== interestIds.length) {
      const known = new Set(valid.map((v) => v.id));
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_INTEREST,
        'Geçersiz ilgi alanı',
        {
          unknownIds: interestIds.filter((id) => !known.has(id)),
        },
      );
    }
    await this.prisma.$transaction([
      this.prisma.userInterest.deleteMany({ where: { userId } }),
      this.prisma.userInterest.createMany({
        data: interestIds.map((interestId) => ({ userId, interestId })),
      }),
    ]);
    return (await this.getMine(userId)).interests;
  }

  async getPreferences(userId: string): Promise<PreferenceDto | null> {
    return this.prisma.preference.findUnique({
      where: { userId },
      select: {
        minAge: true,
        maxAge: true,
        maxDistanceKm: true,
        seekingGenders: true,
        relationshipGoals: true,
      },
    });
  }

  /**
   * Aranan cinsiyet özel nitelikli veridir (K7): ancak güncel açık rıza varken kaydedilir.
   * Boş liste her zaman kabul edilir (keşfet kapalı kalır).
   */
  async setPreferences(userId: string, input: SetPreferencesDto): Promise<PreferenceDto> {
    if (input.minAge > input.maxAge) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'İstek doğrulanamadı',
        [{ field: 'minAge', messages: ['minAge, maxAge değerinden büyük olamaz'] }],
      );
    }
    if (
      input.seekingGenders.length > 0 &&
      !(await this.consents.isGranted(userId, 'SPECIAL_CATEGORY_ORIENTATION'))
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.CONSENT_REQUIRED,
        'Kimi aradığını kaydetmek için açık rızan gerekiyor',
        { type: 'SPECIAL_CATEGORY_ORIENTATION' },
      );
    }
    const data = {
      minAge: input.minAge,
      maxAge: input.maxAge,
      maxDistanceKm: input.maxDistanceKm,
      seekingGenders: input.seekingGenders,
      relationshipGoals: input.relationshipGoals,
    };
    return this.prisma.preference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: {
        minAge: true,
        maxAge: true,
        maxDistanceKm: true,
        seekingGenders: true,
        relationshipGoals: true,
      },
    });
  }

  /** Gerçek koordinat bu fonksiyondan dışarı çıkmaz: yalnızca bulanıklaştırılmış nokta yazılır. */
  async updateLocation(userId: string, input: UpdateLocationDto): Promise<Date> {
    const exists = await this.prisma.profile.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (!exists) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.PROFILE_REQUIRED,
        'Önce profilini oluştur',
      );
    }
    const fuzzed = fuzzLocation(input, this.locationSecret, userId);
    const now = new Date();
    await this.prisma.$executeRaw`
      UPDATE "Profile"
      SET "location" = ST_SetSRID(ST_MakePoint(${fuzzed.longitude}, ${fuzzed.latitude}), 4326)::geography,
          "locationUpdatedAt" = ${now},
          "updatedAt" = ${now}
      WHERE "userId" = ${userId}::uuid`;
    return now;
  }
}

function toInterestDto(row: {
  id: number;
  slug: string;
  category: string;
  labelTr: string;
}): InterestDto {
  return { id: row.id, slug: row.slug, category: row.category, label: row.labelTr };
}
