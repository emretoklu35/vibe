import { Inject, Injectable, Logger } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';

/** Selfie, karardan bu kadar gün sonra silinir (yalnızca itiraz/denetim için kısa süre tutulur). */
export const SELFIE_RETENTION_DAYS = 30;

export type RetentionResult = { accessLogs: number; evidence: number; selfies: number };

/**
 * Saklama süresi dolan verilerin silinmesi (worker, günlük):
 * - 5651 erişim kayıtları (ACCESS_LOG_RETENTION_DAYS)
 * - Kapanan şikayetlerin kanıtı (evidencePurgeAt)
 * - Karara bağlanmış doğrulamaların selfie'leri (30 gün)
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async run(now = new Date()): Promise<RetentionResult> {
    const accessLogs = await this.prisma.accessLog.deleteMany({
      where: {
        createdAt: {
          lt: new Date(now.getTime() - this.config.ACCESS_LOG_RETENTION_DAYS * 86_400_000),
        },
      },
    });

    const reports = await this.prisma.report.findMany({
      where: { evidencePurgeAt: { lte: now } },
      select: { id: true },
      take: 500,
    });
    for (const report of reports) {
      await this.storage.removePrefix(`evidence/${report.id}/`);
      await this.prisma.report.update({
        where: { id: report.id },
        data: { evidence: { purged: true, purgedAt: now.toISOString() }, evidencePurgeAt: null },
      });
    }

    const selfies = await this.prisma.verification.findMany({
      where: {
        selfieKey: { not: null },
        reviewedAt: { lte: new Date(now.getTime() - SELFIE_RETENTION_DAYS * 86_400_000) },
      },
      select: { id: true, selfieKey: true },
      take: 500,
    });
    if (selfies.length > 0) {
      await this.storage.remove(selfies.map((s) => s.selfieKey!));
      await this.prisma.verification.updateMany({
        where: { id: { in: selfies.map((s) => s.id) } },
        data: { selfieKey: null },
      });
    }

    const result = {
      accessLogs: accessLogs.count,
      evidence: reports.length,
      selfies: selfies.length,
    };
    if (result.accessLogs + result.evidence + result.selfies > 0)
      this.logger.log(result, 'Saklama süresi dolan veriler silindi');
    return result;
  }
}
