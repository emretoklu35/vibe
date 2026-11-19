import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { ReportReason } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { ageOn, toCalendarDate, todayInTurkey } from '../users/age.js';
import { BlocksService } from './blocks.service.js';
import type { CreateReportDto, ReportCreatedDto } from './dto/reports.dto.js';

/** Yüksek = önce incelenir. Reşit olmayan ve tehdit şikayetleri en üstte (01-MIMARI §7.5–7.6). */
export const REPORT_PRIORITY: Record<ReportReason, number> = {
  UNDERAGE: 100,
  VIOLENCE_THREAT: 90,
  NUDITY_SEXUAL: 70,
  HATE: 60,
  HARASSMENT: 60,
  OFFLINE_BEHAVIOR: 60,
  SCAM_SPAM: 50,
  FAKE_PROFILE: 40,
  OTHER: 20,
};

/** Bu kadar farklı kişiden açık şikayet alan hesap, inceleme bitene kadar keşfetten gizlenir. */
export const AUTO_HOLD_DISTINCT_REPORTERS = 3;
const MESSAGE_CONTEXT = 20;

export const evidencePrefix = (reportId: string) => `evidence/${reportId}/`;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly blocks: BlocksService,
  ) {}

  async create(reporterId: string, input: CreateReportDto): Promise<ReportCreatedDto> {
    if (reporterId === input.userId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.CANNOT_TARGET_SELF,
        'Kendini şikayet edemezsin',
      );
    }
    const reported = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        birthDate: true,
        profile: {
          select: { displayName: true, bio: true, jobTitle: true, cityName: true, gender: true },
        },
        photos: {
          where: { status: { in: ['APPROVED', 'NEEDS_REVIEW', 'REJECTED'] } },
          orderBy: { position: 'asc' },
          select: { id: true, storageKey: true },
        },
      },
    });
    if (!reported)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Kişi bulunamadı');

    const targetId = input.targetType === 'PROFILE' ? null : (input.targetId ?? null);
    if (input.targetType !== 'PROFILE' && !targetId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'İstek doğrulanamadı',
        [{ field: 'targetId', messages: ['Fotoğraf veya mesaj şikayetinde targetId gerekli'] }],
      );
    }

    // Aynı kişi aynı içeriği tekrar şikayet ederse yeni kayıt açılmaz.
    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId,
        reportedUserId: input.userId,
        targetType: input.targetType,
        targetId,
        status: { in: ['OPEN', 'IN_REVIEW'] },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      if (input.alsoBlock) await this.blocks.block(reporterId, input.userId);
      return existing;
    }

    const messageEvidence =
      input.targetType === 'MESSAGE'
        ? await this.messageEvidence(reporterId, input.userId, targetId!)
        : undefined;
    if (input.targetType === 'PHOTO' && !reported.photos.some((p) => p.id === targetId)) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Fotoğraf bulunamadı');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedUserId: input.userId,
        reason: input.reason,
        targetType: input.targetType,
        targetId,
        comment: input.comment?.trim() || null,
        priority: REPORT_PRIORITY[input.reason],
        evidence: {},
      },
      select: { id: true, status: true },
    });

    // Kanıt: profil anlık görüntüsü, ilgili mesaj ve bağlamı, fotoğrafların kopyaları.
    const photoKeys: string[] = [];
    for (const [index, photo] of reported.photos.entries()) {
      const target = `${evidencePrefix(report.id)}photo-${index}.jpg`;
      try {
        await this.storage.copy(photo.storageKey, target);
        photoKeys.push(target);
      } catch (error) {
        this.logger.warn({ err: error, reportId: report.id }, 'Kanıt fotoğrafı kopyalanamadı');
      }
    }
    await this.prisma.report.update({
      where: { id: report.id },
      data: {
        evidence: {
          capturedAt: new Date().toISOString(),
          profile: reported.profile
            ? {
                ...reported.profile,
                age: reported.birthDate
                  ? ageOn(toCalendarDate(reported.birthDate), todayInTurkey())
                  : null,
              }
            : null,
          photoKeys,
          reportedPhotoIndex:
            input.targetType === 'PHOTO'
              ? reported.photos.findIndex((p) => p.id === targetId)
              : null,
          ...(messageEvidence
            ? { message: messageEvidence.message, context: messageEvidence.context }
            : {}),
        },
      },
    });

    await this.applyAutomaticHold(input.userId, input.reason);
    if (input.alsoBlock) await this.blocks.block(reporterId, input.userId);
    return report;
  }

  /**
   * Mesaj yalnızca şikayet edenin katılımcı olduğu (ayrılmış olsa bile) bir sohbette ve şikayet
   * edilen kişi tarafından gönderilmişse şikayet edilebilir. Silinmiş mesajın metni kanıtta tutulmaz.
   */
  private async messageEvidence(reporterId: string, reportedId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: reportedId,
        conversation: { participants: { some: { userId: reporterId } } },
      },
      select: { id: true, conversationId: true, body: true, createdAt: true, deletedAt: true },
    });
    if (!message)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Mesaj bulunamadı');
    const context = await this.prisma.message.findMany({
      where: { conversationId: message.conversationId, createdAt: { lte: message.createdAt } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MESSAGE_CONTEXT,
      select: { id: true, senderId: true, body: true, createdAt: true, deletedAt: true },
    });
    return {
      message: {
        id: message.id,
        body: message.deletedAt ? '' : message.body,
        createdAt: message.createdAt,
      },
      context: context.reverse().map((m) => ({
        id: m.id,
        from:
          m.senderId === reportedId
            ? 'reported'
            : m.senderId === reporterId
              ? 'reporter'
              : 'system',
        body: m.deletedAt ? '' : m.body,
        createdAt: m.createdAt,
      })),
    };
  }

  /** Reşit olmayan şikayeti hemen; diğerleri belirli sayıda farklı kişiden gelince keşfetten gizler. */
  private async applyAutomaticHold(userId: string, reason: ReportReason): Promise<void> {
    let hold = reason === 'UNDERAGE';
    if (!hold) {
      const reporters = await this.prisma.report.findMany({
        where: {
          reportedUserId: userId,
          status: { in: ['OPEN', 'IN_REVIEW'] },
          reporterId: { not: null },
        },
        distinct: ['reporterId'],
        select: { reporterId: true },
      });
      hold = reporters.length >= AUTO_HOLD_DISTINCT_REPORTERS;
    }
    if (hold) {
      await this.prisma.user.update({ where: { id: userId }, data: { moderationHold: true } });
      this.logger.log({ userId, reason }, 'Hesap inceleme için keşfetten gizlendi');
    }
  }
}
