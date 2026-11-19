import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ALLOW_DELETION_PENDING, IS_PUBLIC } from './auth.decorators.js';
import { TokensService } from './tokens.service.js';

/**
 * Global guard: her uç varsayılan olarak korumalıdır (@Public ile açılır).
 * JWT doğrulandıktan sonra oturumun iptal edilmediği ve hesabın durumu DB'den kontrol edilir;
 * böylece çıkış, ban ve silme talebi access token süresini beklemeden etkili olur.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearer(request.headers.authorization);
    if (!token) {
      throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, 'Giriş gerekli');
    }

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
        {
          suspendedUntil,
        },
      );
    }
    if (
      status === 'DELETION_PENDING' &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_DELETION_PENDING, targets)
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ACCOUNT_DELETION_PENDING,
        'Hesap silinmek üzere; devam etmek için silme talebini geri alın',
      );
    }

    request.auth = { userId: claims.userId, sessionId: claims.sessionId };
    return true;
  }
}

function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}
