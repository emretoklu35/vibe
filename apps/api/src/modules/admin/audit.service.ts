import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

/**
 * Yönetici işlemleri denetim kaydı (brief §7). Yalnızca ekleme (DB tetikleyicisi güncellemeyi reddeder).
 * metadata'ya kişisel veri veya mesaj içeriği yazılmaz; yalnızca kimlikler ve karar gerekçesi.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    adminId: string | null,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata?: Prisma.InputJsonValue,
    ipAddress?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { adminId, action, targetType, targetId, metadata, ipAddress: ipAddress?.slice(0, 64) },
    });
  }
}
