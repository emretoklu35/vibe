import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SessionsService } from '../auth/sessions.service.js';
import { ConsentsService } from '../privacy/consents.service.js';
import {
  ageOn,
  formatCalendarDate,
  MAXIMUM_AGE,
  MINIMUM_AGE,
  parseCalendarDate,
  toCalendarDate,
  todayInTurkey,
} from './age.js';
import { type DeletionInfoDto, type MeDto, OnboardingStep } from './dto/users.dto.js';
import { RegistrationBlockService } from './registration-block.service.js';

export const DELETION_GRACE_DAYS = 30;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly consents: ConsentsService,
    private readonly sessions: SessionsService,
    private readonly registrationBlock: RegistrationBlockService,
  ) {}

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        birthDate: true,
        createdAt: true,
        dataRequests: {
          where: { type: 'DELETION', status: { in: ['REQUESTED', 'PROCESSING'] } },
          select: { requestedAt: true, scheduledFor: true },
          take: 1,
        },
      },
    });
    const birth = user.birthDate ? toCalendarDate(user.birthDate) : null;
    const pending = user.dataRequests[0];
    return {
      id: user.id,
      status: user.status,
      birthDate: birth ? formatCalendarDate(birth) : null,
      age: birth ? ageOn(birth, todayInTurkey()) : null,
      onboardingStep: await this.onboardingStep(user.id, user.birthDate !== null),
      deletion:
        pending?.scheduledFor != null
          ? { requestedAt: pending.requestedAt, scheduledFor: pending.scheduledFor }
          : null,
      createdAt: user.createdAt,
    };
  }

  /**
   * Onboarding sırası: doğum tarihi → zorunlu rızalar → profil → en az bir fotoğraf → keşfet tercihleri.
   * Tercih satırının varlığı, kullanıcının tercih adımını (rıza vermeden geçmiş olsa bile) bitirdiğini gösterir.
   */
  async onboardingStep(userId: string, hasBirthDate: boolean): Promise<OnboardingStep> {
    if (!hasBirthDate) return OnboardingStep.BIRTH_DATE;
    if (!(await this.consents.hasAllRequired(userId))) return OnboardingStep.CONSENTS;
    const [profile, photos, preference] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { userId: true } }),
      this.prisma.profilePhoto.count({
        where: { userId, status: { in: ['PROCESSING', 'APPROVED', 'NEEDS_REVIEW'] } },
      }),
      this.prisma.preference.findUnique({ where: { userId }, select: { userId: true } }),
    ]);
    if (!profile) return OnboardingStep.PROFILE;
    if (photos === 0) return OnboardingStep.PHOTOS;
    if (!preference) return OnboardingStep.PREFERENCES;
    return OnboardingStep.COMPLETE;
  }

  /**
   * Doğum tarihi yalnızca bir kez girilir. 18 yaş altı beyanında hesap ve tüm verisi hemen silinir,
   * aynı numara 30 gün yeniden kayıt olamaz (yalnızca numara özeti saklanır).
   */
  async setBirthDate(userId: string, value: string): Promise<void> {
    const birth = parseCalendarDate(value);
    const today = todayInTurkey();
    const age = birth ? ageOn(birth, today) : undefined;
    if (!birth || age === undefined || age < 0 || age > MAXIMUM_AGE) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_BIRTH_DATE,
        'Geçerli bir doğum tarihi girin',
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { birthDate: true, phoneHash: true },
    });
    if (user.birthDate) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.BIRTH_DATE_ALREADY_SET,
        'Doğum tarihi daha önce girildi; değiştirmek için destek ile iletişime geçin',
      );
    }

    if (age < MINIMUM_AGE) {
      await this.registrationBlock.block(user.phoneHash);
      await this.prisma.user.delete({ where: { id: userId } });
      this.logger.log({ userId }, '18 yaş altı beyanı: hesap silindi');
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.UNDERAGE,
        'VIBE yalnızca 18 yaş ve üzeri kullanıcılar içindir',
      );
    }

    // Eşzamanlı iki istekte yalnızca biri yazar.
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, birthDate: null },
      data: { birthDate: new Date(Date.UTC(birth.year, birth.month - 1, birth.day)) },
    });
    if (count !== 1) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.BIRTH_DATE_ALREADY_SET,
        'Doğum tarihi daha önce girildi; değiştirmek için destek ile iletişime geçin',
      );
    }
  }

  /**
   * Hesap silme talebi: hesap hemen görünmez olur, tüm oturumlar kapanır,
   * 30 gün sonra worker kalıcı olarak siler. Bu süre içinde giriş yapıp geri alınabilir.
   */
  async requestDeletion(userId: string): Promise<DeletionInfoDto> {
    const existing = await this.prisma.dataRequest.findFirst({
      where: { userId, type: 'DELETION', status: { in: ['REQUESTED', 'PROCESSING'] } },
      select: { requestedAt: true, scheduledFor: true },
    });
    if (existing?.scheduledFor) {
      return { requestedAt: existing.requestedAt, scheduledFor: existing.scheduledFor };
    }

    const requestedAt = new Date();
    const scheduledFor = new Date(
      requestedAt.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { status: 'DELETION_PENDING', deletionRequestedAt: requestedAt },
      }),
      this.prisma.dataRequest.create({
        data: { userId, type: 'DELETION', requestedAt, scheduledFor },
      }),
    ]);
    await this.sessions.revokeAll(userId, 'account_deletion');
    return { requestedAt, scheduledFor };
  }

  async restore(userId: string): Promise<void> {
    const restored = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.dataRequest.updateMany({
        where: { userId, type: 'DELETION', status: 'REQUESTED' },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });
      if (count === 0) return false;
      await tx.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE', deletionRequestedAt: null },
      });
      return true;
    });
    if (!restored) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.ACCOUNT_NOT_PENDING_DELETION,
        'Geri alınacak bir silme talebi yok',
      );
    }
  }
}
