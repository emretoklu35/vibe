import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { ReportStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { SessionsService } from '../auth/sessions.service.js';
import { ageOn, toCalendarDate, todayInTurkey } from '../users/age.js';
import { AuditService } from './audit.service.js';
import type { AdminContext } from './auth/admin-auth.service.js';
import type {
  AdminUserDto,
  AuditLogDto,
  ReportDetailDto,
  ReportSummaryDto,
  ReviewPhotoDto,
  UserAction,
  VerificationReviewDto,
} from './dto/admin.dto.js';

const URL_TTL = 10 * 60;
const LIST_LIMIT = 100;
/** Kapanan şikayetin kanıtı bu süre sonra silinir (hukuki teyit gerekli: açık karar #17). */
export const EVIDENCE_RETENTION_DAYS = 730;

const notFound = (what: string) =>
  new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, `${what} bulunamadı`);

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly sessions: SessionsService,
  ) {}

  // ─── Şikayetler ───────────────────────────────────────────────

  async listReports(status?: ReportStatus): Promise<ReportSummaryDto[]> {
    const rows = await this.prisma.report.findMany({
      where: { status: status ?? { in: ['OPEN', 'IN_REVIEW'] } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: LIST_LIMIT,
      include: { reportedUser: { select: { profile: { select: { displayName: true } } } } },
    });
    const counts = await this.openCounts(
      rows.map((r) => r.reportedUserId).filter((id): id is string => Boolean(id)),
    );
    return rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      targetType: r.targetType,
      priority: r.priority,
      reportedUserId: r.reportedUserId,
      reportedName: r.reportedUser?.profile?.displayName ?? null,
      openReportsAgainst: r.reportedUserId ? (counts.get(r.reportedUserId) ?? 0) : 0,
      createdAt: r.createdAt,
    }));
  }

  async getReport(id: string): Promise<ReportDetailDto> {
    const r = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reportedUser: { select: { profile: { select: { displayName: true } } } },
        handledBy: { select: { email: true } },
      },
    });
    if (!r) throw notFound('Şikayet');
    const evidence = (r.evidence ?? {}) as { photoKeys?: string[] };
    const counts = r.reportedUserId
      ? await this.openCounts([r.reportedUserId])
      : new Map<string, number>();
    return {
      id: r.id,
      reason: r.reason,
      status: r.status,
      targetType: r.targetType,
      priority: r.priority,
      reportedUserId: r.reportedUserId,
      reportedName: r.reportedUser?.profile?.displayName ?? null,
      openReportsAgainst: r.reportedUserId ? (counts.get(r.reportedUserId) ?? 0) : 0,
      createdAt: r.createdAt,
      comment: r.comment,
      reporterId: r.reporterId,
      evidence: r.evidence as Record<string, unknown>,
      evidencePhotoUrls: await Promise.all(
        (evidence.photoKeys ?? []).map((key) => this.storage.presignDownload(key, URL_TTL)),
      ),
      resolutionNote: r.resolutionNote,
      resolvedAt: r.resolvedAt,
      handledBy: r.handledBy?.email ?? null,
    };
  }

  async updateReport(
    admin: AdminContext,
    id: string,
    status: 'IN_REVIEW' | 'ACTION_TAKEN' | 'DISMISSED',
    note: string | undefined,
    ip?: string,
  ): Promise<ReportDetailDto> {
    const closing = status !== 'IN_REVIEW';
    const resolvedAt = closing ? new Date() : null;
    const { count } = await this.prisma.report.updateMany({
      where: { id },
      data: {
        status,
        handledByAdminId: admin.adminId,
        resolutionNote: note ?? null,
        resolvedAt,
        evidencePurgeAt: resolvedAt
          ? new Date(resolvedAt.getTime() + EVIDENCE_RETENTION_DAYS * 86_400_000)
          : null,
      },
    });
    if (count === 0) throw notFound('Şikayet');
    await this.audit.record(
      admin.adminId,
      `report.${status.toLowerCase()}`,
      'report',
      id,
      { note: note ?? null },
      ip,
    );
    return this.getReport(id);
  }

  // ─── Fotoğraflar ──────────────────────────────────────────────

  async photosForReview(): Promise<ReviewPhotoDto[]> {
    const rows = await this.prisma.profilePhoto.findMany({
      where: { status: 'NEEDS_REVIEW' },
      orderBy: { createdAt: 'asc' },
      take: LIST_LIMIT,
    });
    return Promise.all(
      rows.map(async (p) => ({
        id: p.id,
        userId: p.userId,
        status: p.status,
        url: await this.storage.presignDownload(p.storageKey, URL_TTL),
        labels: (p.moderationLabels as Record<string, unknown> | null) ?? null,
        createdAt: p.createdAt,
      })),
    );
  }

  async decidePhoto(
    admin: AdminContext,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    ip?: string,
  ): Promise<void> {
    const { count } = await this.prisma.profilePhoto.updateMany({
      where: { id, status: { in: ['NEEDS_REVIEW', 'APPROVED', 'REJECTED'] } },
      data: { status: decision },
    });
    if (count === 0) throw notFound('Fotoğraf');
    await this.audit.record(
      admin.adminId,
      `photo.${decision.toLowerCase()}`,
      'photo',
      id,
      undefined,
      ip,
    );
  }

  // ─── Selfie doğrulama ─────────────────────────────────────────

  async verificationsForReview(): Promise<VerificationReviewDto[]> {
    const rows = await this.prisma.verification.findMany({
      where: { status: 'PENDING', submittedAt: { not: null } },
      orderBy: { submittedAt: 'asc' },
      take: LIST_LIMIT,
      include: {
        user: {
          select: {
            profile: { select: { displayName: true } },
            photos: {
              where: { status: 'APPROVED' },
              orderBy: { position: 'asc' },
              select: { storageKey: true },
            },
          },
        },
      },
    });
    return Promise.all(
      rows.map(async (v) => ({
        id: v.id,
        userId: v.userId,
        displayName: v.user.profile?.displayName ?? null,
        submittedAt: v.submittedAt,
        selfieUrl: v.selfieKey ? await this.storage.presignDownload(v.selfieKey, URL_TTL) : null,
        profilePhotoUrls: await Promise.all(
          v.user.photos.map((p) => this.storage.presignDownload(p.storageKey, URL_TTL)),
        ),
      })),
    );
  }

  async decideVerification(
    admin: AdminContext,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    note: string | undefined,
    ip?: string,
  ): Promise<void> {
    const verification = await this.prisma.verification.findFirst({
      where: { id, status: 'PENDING', submittedAt: { not: null } },
      select: { userId: true },
    });
    if (!verification) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.VERIFICATION_NOT_PENDING,
        'İncelemede bekleyen doğrulama yok',
      );
    }
    await this.prisma.$transaction([
      this.prisma.verification.update({
        where: { id },
        data: {
          status: decision,
          reviewedById: admin.adminId,
          reviewedAt: new Date(),
          note: note ?? null,
        },
      }),
      ...(decision === 'APPROVED'
        ? [
            this.prisma.user.update({
              where: { id: verification.userId },
              data: { verifiedAt: new Date(), verificationRequired: false },
            }),
          ]
        : []),
    ]);
    await this.audit.record(
      admin.adminId,
      `verification.${decision.toLowerCase()}`,
      'user',
      verification.userId,
      { verificationId: id },
      ip,
    );
  }

  // ─── Hesaplar ─────────────────────────────────────────────────

  async getUser(id: string): Promise<AdminUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: { select: { displayName: true, bio: true } },
        photos: {
          orderBy: { position: 'asc' },
          select: { id: true, status: true, storageKey: true },
        },
        reportsAgainst: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, reason: true, status: true, createdAt: true },
        },
        _count: { select: { reportsFiled: true } },
      },
    });
    if (!user) throw notFound('Hesap');
    const viewable = new Set(['APPROVED', 'NEEDS_REVIEW', 'REJECTED']);
    return {
      id: user.id,
      status: user.status,
      suspendedUntil: user.suspendedUntil,
      displayName: user.profile?.displayName ?? null,
      age: user.birthDate ? ageOn(toCalendarDate(user.birthDate), todayInTurkey()) : null,
      bio: user.profile?.bio ?? null,
      verified: user.verifiedAt !== null,
      verificationRequired: user.verificationRequired,
      moderationHold: user.moderationHold,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      photos: await Promise.all(
        user.photos.map(async (p) => ({
          id: p.id,
          status: p.status,
          url: viewable.has(p.status)
            ? await this.storage.presignDownload(p.storageKey, URL_TTL)
            : null,
        })),
      ),
      reportsAgainst: user.reportsAgainst,
      reportsFiled: user._count.reportsFiled,
    };
  }

  /**
   * Hesap işlemleri. Askıya alma ve ban tüm oturumları hemen kapatır (açık socket'ler dahil).
   * Rol kontrolü controller'da: SUSPEND/BAN/RESTORE yalnızca ADMIN+.
   */
  async actOnUser(
    admin: AdminContext,
    id: string,
    action: UserAction,
    reason: string,
    days?: number,
    ip?: string,
  ): Promise<AdminUserDto> {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound('Hesap');

    switch (action) {
      case 'SUSPEND': {
        const until = new Date(Date.now() + (days ?? 7) * 86_400_000);
        await this.prisma.user.update({
          where: { id },
          data: { status: 'SUSPENDED', suspendedUntil: until },
        });
        await this.sessions.revokeAll(id, 'revoked_by_user');
        break;
      }
      case 'BAN':
        await this.prisma.user.update({
          where: { id },
          data: { status: 'BANNED', suspendedUntil: null },
        });
        await this.sessions.revokeAll(id, 'revoked_by_user');
        break;
      case 'RESTORE':
        await this.prisma.user.update({
          where: { id, status: { in: ['SUSPENDED', 'BANNED'] } },
          data: { status: 'ACTIVE', suspendedUntil: null },
        });
        break;
      case 'REQUIRE_VERIFICATION':
        await this.prisma.user.update({ where: { id }, data: { verificationRequired: true } });
        break;
      case 'HOLD':
        await this.prisma.user.update({ where: { id }, data: { moderationHold: true } });
        break;
      case 'RELEASE_HOLD':
        await this.prisma.user.update({ where: { id }, data: { moderationHold: false } });
        break;
    }
    await this.audit.record(
      admin.adminId,
      `user.${action.toLowerCase()}`,
      'user',
      id,
      { reason, days: days ?? null },
      ip,
    );
    return this.getUser(id);
  }

  async auditLogs(): Promise<AuditLogDto[]> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      include: { admin: { select: { email: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      adminEmail: r.admin?.email ?? null,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      createdAt: r.createdAt,
    }));
  }

  private async openCounts(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const grouped = await this.prisma.report.groupBy({
      by: ['reportedUserId'],
      where: { reportedUserId: { in: userIds }, status: { in: ['OPEN', 'IN_REVIEW'] } },
      _count: { _all: true },
    });
    return new Map(grouped.map((g) => [g.reportedUserId!, g._count._all]));
  }
}
