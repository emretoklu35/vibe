import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';

import { PrismaService } from '../../infra/prisma/prisma.service.js';

/**
 * 5651 trafik/erişim kaydı: oturum açmış kullanıcının veri değiştiren her isteği (IP, kaynak port,
 * işlem, zaman) yazılır. İşlem adı rota şablonudur ("/api/v1/conversations/:id/messages"): kimlik veya
 * içerik yazılmaz. Kayıt başarısız olursa istek etkilenmez (yalnızca loglanır).
 *
 * Not: yük dengeleyici arkasında kaynak port, dengeleyicinin iletmesine bağlıdır (Faz 7 altyapı).
 */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AccessLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method === 'GET' || request.method === 'HEAD') return next.handle();

    return next.handle().pipe(
      tap(() => {
        const userId = request.auth?.userId;
        if (!userId) return;
        const route = (request.route as { path?: string } | undefined)?.path ?? request.path;
        void this.prisma.accessLog
          .create({
            data: {
              userId,
              ipAddress: (request.ip ?? 'unknown').slice(0, 64),
              port: request.socket.remotePort ?? null,
              action: `${request.method} ${route}`.slice(0, 96),
            },
          })
          .catch((error: unknown) => this.logger.error({ err: error }, 'Erişim kaydı yazılamadı'));
      }),
    );
  }
}

/** Giriş gibi oturum öncesi olaylar için doğrudan kayıt. */
export async function recordAccess(
  prisma: PrismaService,
  entry: { userId: string; ip?: string; port?: number; action: string },
): Promise<void> {
  await prisma.accessLog.create({
    data: {
      userId: entry.userId,
      ipAddress: (entry.ip ?? 'unknown').slice(0, 64),
      port: entry.port ?? null,
      action: entry.action.slice(0, 96),
    },
  });
}
