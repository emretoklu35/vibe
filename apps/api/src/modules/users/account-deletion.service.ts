import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service.js';

export type PurgeResult = { completed: number; failed: number };

/**
 * Süresi dolan silme taleplerini yerine getirir (worker tarafından periyodik çağrılır).
 * Kullanıcıya ait satırlar FK cascade ile silinir; DataRequest kaydı userId=null olarak uyum kanıtı kalır.
 * Faz 3'te medya (S3) silme adımı buraya eklenecek.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async purgeDue(now = new Date(), batchSize = 50): Promise<PurgeResult> {
    const due = await this.prisma.dataRequest.findMany({
      where: { type: 'DELETION', status: 'REQUESTED', scheduledFor: { lte: now } },
      orderBy: { scheduledFor: 'asc' },
      take: batchSize,
      select: { id: true, userId: true },
    });

    const result: PurgeResult = { completed: 0, failed: 0 };
    for (const request of due) {
      // Talebi sahiplen: aynı anda çalışan ikinci worker aynı talebi işlemesin.
      const { count } = await this.prisma.dataRequest.updateMany({
        where: { id: request.id, status: 'REQUESTED' },
        data: { status: 'PROCESSING' },
      });
      if (count !== 1) continue;

      try {
        await this.prisma.$transaction([
          ...(request.userId
            ? [
                this.prisma.user.deleteMany({
                  where: { id: request.userId, status: 'DELETION_PENDING' },
                }),
              ]
            : []),
          this.prisma.dataRequest.update({
            where: { id: request.id },
            data: { status: 'COMPLETED', completedAt: new Date() },
          }),
        ]);
        result.completed += 1;
      } catch (error) {
        result.failed += 1;
        this.logger.error({ err: error, dataRequestId: request.id }, 'Hesap silme başarısız');
        await this.prisma.dataRequest.update({
          where: { id: request.id },
          data: { status: 'FAILED', failureReason: (error as Error).message.slice(0, 256) },
        });
      }
    }

    if (due.length > 0) this.logger.log(result, 'Silme talepleri işlendi');
    return result;
  }
}
