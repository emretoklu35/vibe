import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PhoneCryptoService } from '../../infra/crypto/phone-crypto.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { AccountStatus } from '../../generated/prisma/enums.js';
import type { OnboardingStep } from '../users/dto/users.dto.js';
import { RegistrationBlockService } from '../users/registration-block.service.js';
import { UsersService } from '../users/users.service.js';
import { OtpService } from './otp.service.js';
import { type SessionClient, SessionsService, type TokenPair } from './sessions.service.js';

export type SignInResult = {
  tokens: TokenPair;
  user: { id: string; isNew: boolean; status: AccountStatus; onboardingStep: OnboardingStep };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: PhoneCryptoService,
    private readonly otp: OtpService,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
    private readonly registrationBlock: RegistrationBlockService,
  ) {}

  /** Kod doğrulanınca kullanıcı bulunur ya da oluşturulur ve yeni bir oturum açılır. */
  async signIn(e164: string, code: string, client: SessionClient): Promise<SignInResult> {
    await this.otp.consume(e164, code);
    const phoneHash = this.crypto.hash(e164);

    let user = await this.prisma.user.findUnique({
      where: { phoneHash },
      select: { id: true, status: true, suspendedUntil: true, birthDate: true },
    });
    let isNew = false;

    if (!user) {
      const blockedFor = await this.registrationBlock.remainingSeconds(phoneHash);
      if (blockedFor) {
        throw new AppException(
          HttpStatus.FORBIDDEN,
          ErrorCode.REGISTRATION_BLOCKED,
          'Bu numarayla şu anda kayıt olunamıyor',
          { retryAfterSeconds: blockedFor },
        );
      }
      user = await this.createUser(phoneHash, e164);
      isNew = true;
    }

    if (user.status === 'BANNED') {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ACCOUNT_BANNED, 'Hesap kapatıldı');
    }
    if (user.status === 'SUSPENDED' && (!user.suspendedUntil || user.suspendedUntil > new Date())) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ACCOUNT_SUSPENDED,
        'Hesap geçici olarak askıya alındı',
        { suspendedUntil: user.suspendedUntil },
      );
    }

    const tokens = await this.sessions.create(user.id, client);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });

    return {
      tokens,
      user: {
        id: user.id,
        isNew,
        status: user.status,
        onboardingStep: await this.users.onboardingStep(user.id, user.birthDate !== null),
      },
    };
  }

  private async createUser(phoneHash: string, e164: string) {
    const select = { id: true, status: true, suspendedUntil: true, birthDate: true } as const;
    try {
      return await this.prisma.user.create({
        data: { phoneHash, phoneEncrypted: new Uint8Array(this.crypto.encrypt(e164)) },
        select,
      });
    } catch (error) {
      // Aynı numara için eşzamanlı ilk giriş: kazanan kaydı kullan.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.user.findUniqueOrThrow({ where: { phoneHash }, select });
      }
      throw error;
    }
  }
}
