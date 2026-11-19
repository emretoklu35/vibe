import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppException } from '../../../common/errors/app.exception.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { AdminRole } from '../../../generated/prisma/enums.js';
import { type AdminContext, AdminAuthService } from './admin-auth.service.js';

declare module 'express' {
  interface Request {
    admin?: AdminContext;
  }
}

const ADMIN_ROLES = 'vibe:admin-roles';

/**
 * Rol matrisi:
 * - SUPPORT: hesap ve şikayet görüntüleme (salt okunur)
 * - MODERATOR: şikayet kuyruğu, fotoğraf ve selfie incelemesi, doğrulama isteme, inceleme beklemesi
 * - ADMIN: + askıya alma, ban, geri açma, denetim kaydı
 * - SUPER_ADMIN: hepsi (yönetici hesapları yalnızca sunucuda komut satırıyla oluşturulur)
 */
export const Roles = {
  READ: ['SUPPORT', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'],
  MODERATE: ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'],
  ENFORCE: ['ADMIN', 'SUPER_ADMIN'],
} as const satisfies Record<string, readonly AdminRole[]>;

export const AdminRoles = (roles: readonly AdminRole[]) => SetMetadata(ADMIN_ROLES, roles);

export const CurrentAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AdminContext => {
    const admin = ctx.switchToHttp().getRequest<Request>().admin;
    if (!admin) throw new Error('CurrentAdmin AdminGuard olmadan kullanıldı');
    return admin;
  },
);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const [scheme, token] = header?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHENTICATED,
        'Yönetici girişi gerekli',
      );
    }
    const admin = await this.auth.authenticate(token);
    const allowed = this.reflector.getAllAndOverride<readonly AdminRole[]>(ADMIN_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed || !allowed.includes(admin.role)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ADMIN_FORBIDDEN,
        'Bu işlem için yetkin yok',
      );
    }
    request.admin = admin;
    return true;
  }
}
