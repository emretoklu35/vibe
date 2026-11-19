import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AuthContext } from './auth.decorators.js';
import { TokensService } from './tokens.service.js';

export type AuthenticatedAccess = AuthContext & { deletionPending: boolean };

/**
 * Access token doğrulamasının tek kaynağı (HTTP guard ve WebSocket bağlantısı aynı kuralı kullanır):
 * JWT imzası/süresi + oturum iptal edilmemiş + hesap banlı/askıda değil.
 */
@Injectable()
export class AccessAuthenticator {
  constructor(
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
  ) {}

  async authenticate(token: string): Promise<AuthenticatedAccess> {
    const claims = await this.tokens.verifyAccessToken(token);
    const session = await this.prisma.session.findUnique({
      where: { id: claims.sessionId },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { status: true, suspendedUntil: true } },
      },
    });

    if (
      !session ||
      session.userId !== claims.userId ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.SESSION_REVOKED,
        'Oturum sonlandırılmış',
      );
    }

    const { status, suspendedUntil } = session.user;
    if (status === 'BANNED') {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ACCOUNT_BANNED, 'Hesap kapatıldı');
    }
    if (status === 'SUSPENDED' && (!suspendedUntil || suspendedUntil > new Date())) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ACCOUNT_SUSPENDED,
        'Hesap geçici olarak askıya alındı',
        { suspendedUntil },
      );
    }
    return {
      userId: claims.userId,
      sessionId: claims.sessionId,
      deletionPending: status === 'DELETION_PENDING',
    };
  }
}
