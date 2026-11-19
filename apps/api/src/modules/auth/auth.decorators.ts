import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export type AuthContext = { userId: string; sessionId: string };

declare module 'express' {
  interface Request {
    auth?: AuthContext;
  }
}

export const IS_PUBLIC = 'vibe:public';
export const ALLOW_DELETION_PENDING = 'vibe:allow-deletion-pending';

/** Kimlik doğrulaması gerektirmeyen uç (varsayılan: her uç korumalıdır). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Silme bekleyen hesapların da erişebileceği uç (hesap bilgisi, geri alma, çıkış). */
export const AllowDeletionPending = () => SetMetadata(ALLOW_DELETION_PENDING, true);

/** Doğrulanmış kullanıcı bağlamı. Yalnızca korumalı uçlarda kullanılır. */
export const CurrentAuth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.auth) throw new Error('CurrentAuth korumasız bir uçta kullanıldı');
    return request.auth;
  },
);
