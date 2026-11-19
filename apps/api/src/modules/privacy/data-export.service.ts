import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { MAINTENANCE_QUEUE_TOKEN } from '../../infra/queue/queue.module.js';
import { BUILD_EXPORT, type BuildExportJob } from '../../infra/queue/queues.js';
import { StorageService } from '../../infra/storage/storage.service.js';

export const EXPORT_DOWNLOAD_DAYS = 7;
const DOWNLOAD_TTL_SECONDS = EXPORT_DOWNLOAD_DAYS * 24 * 3600;

export type ExportStatus = {
  id: string;
  status: 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  requestedAt: Date;
  completedAt: Date | null;
  downloadUrl: string | null;
  expiresAt: Date | null;
};

/**
 * KVKK m.11 / GDPR m.15 veri erişim hakkı: kullanıcının kendi verisini JSON olarak indirmesi.
 * Başkalarının kişisel verisi (karşı tarafın mesajları, profili) dosyaya girmez; yalnızca kullanıcının
 * kendi gönderdiği mesajlar ve kendi kayıtları. Dosya kullanıcının medya alanında tutulur:
 * hesap silinince birlikte silinir.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    // Worker sürecinde kuyruk üreticisi yoktur (yalnızca build çağrılır).
    @Optional() @Inject(MAINTENANCE_QUEUE_TOKEN) private readonly queue?: Queue,
  ) {}

  async request(userId: string): Promise<ExportStatus> {
    const open = await this.prisma.dataRequest.findFirst({
      where: { userId, type: 'EXPORT', status: { in: ['REQUESTED', 'PROCESSING'] } },
    });
    if (open) return this.toStatus(open);
    const created = await this.prisma.dataRequest.create({ data: { userId, type: 'EXPORT' } });
    if (!this.queue) throw new Error('Dışa aktarma kuyruğu yok');
    const job: BuildExportJob = { requestId: created.id };
    await this.queue.add(BUILD_EXPORT, job, { jobId: `export-${created.id}` });
    return this.toStatus(created);
  }

  async latest(userId: string): Promise<ExportStatus | null> {
    const row = await this.prisma.dataRequest.findFirst({
      where: { userId, type: 'EXPORT' },
      orderBy: { requestedAt: 'desc' },
    });
    return row ? this.toStatus(row) : null;
  }

  /** Worker tarafı: dosyayı üretir ve depolar. */
  async build(requestId: string): Promise<'COMPLETED' | 'SKIPPED'> {
    const claimed = await this.prisma.dataRequest.updateMany({
      where: { id: requestId, type: 'EXPORT', status: 'REQUESTED' },
      data: { status: 'PROCESSING' },
    });
    if (claimed.count !== 1) return 'SKIPPED';
    const request = await this.prisma.dataRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (!request.userId) return 'SKIPPED';
    const userId = request.userId;

    try {
      const data = await this.collect(userId);
      const key = `users/${userId}/exports/${requestId}.json`;
      await this.storage.write(key, Buffer.from(JSON.stringify(data, null, 2)), 'application/json');
      await this.prisma.dataRequest.update({
        where: { id: requestId },
        data: { status: 'COMPLETED', completedAt: new Date(), resultKey: key },
      });
      return 'COMPLETED';
    } catch (error) {
      this.logger.error({ err: error, requestId }, 'Veri dışa aktarma başarısız');
      await this.prisma.dataRequest.update({
        where: { id: requestId },
        data: { status: 'FAILED', failureReason: (error as Error).message.slice(0, 256) },
      });
      throw error;
    }
  }

  private async collect(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        birthDate: true,
        status: true,
        createdAt: true,
        verifiedAt: true,
        profile: true,
        preference: true,
        notificationSettings: { select: { newMatch: true, newMessage: true } },
        interests: { select: { interest: { select: { labelTr: true } } } },
        consents: {
          orderBy: { createdAt: 'asc' },
          select: { type: true, granted: true, textVersion: true, createdAt: true },
        },
        photos: {
          select: { id: true, status: true, position: true, storageKey: true, createdAt: true },
        },
        sessions: {
          select: { createdAt: true, lastUsedAt: true, userAgent: true, revokedAt: true },
        },
        likesGiven: { select: { targetId: true, createdAt: true } },
        blocksGiven: { select: { blockedId: true, createdAt: true } },
        reportsFiled: { select: { reason: true, targetType: true, status: true, createdAt: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { conversationId: true, body: true, createdAt: true, deletedAt: true },
        },
      },
    });
    const matches = await this.prisma.match.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: { id: true, status: true, createdAt: true, unmatchedAt: true },
    });
    const { profile } = user;
    return {
      generatedAt: new Date().toISOString(),
      note: 'Bu dosya yalnızca senin kişisel verilerini içerir. Fotoğraf adresleri 7 gün geçerlidir.',
      account: {
        id: user.id,
        birthDate: user.birthDate,
        status: user.status,
        createdAt: user.createdAt,
        verified: user.verifiedAt !== null,
      },
      profile: profile
        ? {
            displayName: profile.displayName,
            gender: profile.gender,
            bio: profile.bio,
            jobTitle: profile.jobTitle,
            heightCm: profile.heightCm,
            relationshipGoal: profile.relationshipGoal,
            smoking: profile.smoking,
            drinking: profile.drinking,
            exercise: profile.exercise,
            wantsChildren: profile.wantsChildren,
            communicationStyle: profile.communicationStyle,
            cityName: profile.cityName,
            isDiscoverable: profile.isDiscoverable,
            locationUpdatedAt: profile.locationUpdatedAt,
            locationNote:
              'Konumun yalnızca bulanıklaştırılmış hâliyle saklanır; kesin koordinat tutulmaz.',
          }
        : null,
      interests: user.interests.map((i) => i.interest.labelTr),
      preferences: user.preference,
      notificationSettings: user.notificationSettings,
      consents: user.consents,
      photos: await Promise.all(
        user.photos.map(async (p) => ({
          status: p.status,
          position: p.position,
          uploadedAt: p.createdAt,
          downloadUrl: ['APPROVED', 'NEEDS_REVIEW', 'REJECTED'].includes(p.status)
            ? await this.storage.presignDownload(p.storageKey, DOWNLOAD_TTL_SECONDS)
            : null,
        })),
      ),
      sessions: user.sessions,
      likesGiven: user.likesGiven,
      matches,
      blocks: user.blocksGiven,
      reportsFiled: user.reportsFiled,
      messagesSent: user.messages.map((m) => ({
        conversationId: m.conversationId,
        body: m.deletedAt ? null : m.body,
        sentAt: m.createdAt,
        deletedAt: m.deletedAt,
      })),
    };
  }

  private async toStatus(row: {
    id: string;
    status: ExportStatus['status'];
    requestedAt: Date;
    completedAt: Date | null;
    resultKey: string | null;
  }): Promise<ExportStatus> {
    const expiresAt = row.completedAt
      ? new Date(row.completedAt.getTime() + EXPORT_DOWNLOAD_DAYS * 86_400_000)
      : null;
    const available =
      row.status === 'COMPLETED' && row.resultKey && expiresAt && expiresAt > new Date();
    if (row.status === 'COMPLETED' && !available) {
      throw new AppException(
        HttpStatus.GONE,
        ErrorCode.NOT_FOUND,
        'Dışa aktarma dosyasının süresi doldu; yeniden iste',
      );
    }
    return {
      id: row.id,
      status: row.status,
      requestedAt: row.requestedAt,
      completedAt: row.completedAt,
      expiresAt,
      downloadUrl: available ? await this.storage.presignDownload(row.resultKey!, 10 * 60) : null,
    };
  }
}
