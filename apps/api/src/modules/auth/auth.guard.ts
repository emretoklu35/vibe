import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ALLOW_DELETION_PENDING, IS_PUBLIC } from './auth.decorators.js';
import { AccessAuthenticator } from './access-authenticator.js';

/**
 * Global guard: her uç varsayılan olarak korumalıdır (@Public ile açılır).
 * Doğrulama AccessAuthenticator'dadır (WebSocket ile ortak): oturum ve hesap durumu DB'den kontrol
 * edilir; böylece çıkış, ban ve silme talebi access token süresini beklemeden etkili olur.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authenticator: AccessAuthenticator,
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

    const access = await this.authenticator.authenticate(token);
    if (
      access.deletionPending &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_DELETION_PENDING, targets)
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ACCOUNT_DELETION_PENDING,
        'Hesap silinmek üzere; devam etmek için silme talebini geri alın',
      );
    }

    request.auth = { userId: access.userId, sessionId: access.sessionId };
    return true;
  }
}

function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}
