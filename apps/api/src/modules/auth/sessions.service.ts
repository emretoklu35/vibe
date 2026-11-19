import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { TokensService } from './tokens.service.js';

export type TokenPair = {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export type SessionClient = { deviceId?: string; userAgent?: string; ip?: string; port?: number };

export type RevokeReason =
  'logout' | 'revoked_by_user' | 'reuse_detected' | 'account_deletion' | 'underage';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    @Inject(APP_CONFIG) config: AppConfig,
    // Worker gibi WebSocket'siz süreçlerde yoktur.
    @Optional() private readonly realtime?: RealtimeService,
  ) {
    this.refreshTtlMs = config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  }

  async create(userId: string, client: SessionClient): Promise<TokenPair> {
    const refreshToken = this.tokens.generateRefreshToken();
    const refreshTokenExpiresAt = new Date(Date.now() + this.refreshTtlMs);
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
        deviceId: client.deviceId,
        userAgent: client.userAgent?.slice(0, 256),
        expiresAt: refreshTokenExpiresAt,
      },
    });
    const access = await this.tokens.signAccessToken({ userId, sessionId: session.id });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  /**
   * Refresh token rotasyonu. Her kullanımda yeni token verilir, eskisi "önceki" olarak saklanır.
   * Önceki token tekrar gelirse token çalınmış sayılır ve oturum tümüyle iptal edilir.
   * Not: istemci aynı anda iki yenileme yapmamalı (mobil istemci tek uçuşlu yenileme yapar).
   */
  async rotate(refreshToken: string): Promise<TokenPair> {
    const presentedHash = this.tokens.hashRefreshToken(refreshToken);
    const now = new Date();

    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: presentedHash },
      include: { user: { select: { status: true } } },
    });

    if (!session) {
      await this.detectReuse(presentedHash);
      throw this.invalid();
    }
    if (session.revokedAt || session.expiresAt <= now) throw this.invalid();
    if (session.user.status === 'BANNED') {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ACCOUNT_BANNED, 'Hesap kapatıldı');
    }

    const nextRefreshToken = this.tokens.generateRefreshToken();
    const refreshTokenExpiresAt = new Date(now.getTime() + this.refreshTtlMs);

    // Koşullu güncelleme: aynı token ile yarışan ikinci istek 0 satır günceller.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: presentedHash, revokedAt: null },
      data: {
        refreshTokenHash: this.tokens.hashRefreshToken(nextRefreshToken),
        previousTokenHash: presentedHash,
        lastUsedAt: now,
        expiresAt: refreshTokenExpiresAt,
      },
    });
    if (count !== 1) {
      await this.detectReuse(presentedHash);
      throw this.invalid();
    }

    const access = await this.tokens.signAccessToken({
      userId: session.userId,
      sessionId: session.id,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt,
    };
  }

  /** Oturumu kapatır; o oturumdan kayıtlı push cihazı silinir, açık socket'leri kesilir. */
  async revoke(sessionId: string, userId: string, reason: RevokeReason): Promise<boolean> {
    const [{ count }] = await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      }),
      this.prisma.userDevice.deleteMany({ where: { sessionId, userId } }),
    ]);
    this.realtime?.disconnectSession(sessionId);
    return count === 1;
  }

  async revokeAll(userId: string, reason: RevokeReason): Promise<number> {
    const [{ count }] = await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      }),
      this.prisma.userDevice.deleteMany({ where: { userId } }),
    ]);
    this.realtime?.disconnectUser(userId);
    return count;
  }

  listActive(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, deviceId: true, userAgent: true, createdAt: true, lastUsedAt: true },
    });
  }

  private async detectReuse(presentedHash: string): Promise<void> {
    const stolen = await this.prisma.session.findUnique({
      where: { previousTokenHash: presentedHash },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!stolen || stolen.revokedAt) return;
    await this.revoke(stolen.id, stolen.userId, 'reuse_detected');
    this.logger.warn(
      { sessionId: stolen.id },
      'Refresh token yeniden kullanıldı; oturum iptal edildi',
    );
    throw new AppException(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.REFRESH_TOKEN_REUSED,
      'Güvenlik nedeniyle oturum kapatıldı, lütfen tekrar giriş yapın',
    );
  }

  private invalid(): AppException {
    return new AppException(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.REFRESH_TOKEN_INVALID,
      'Oturum geçersiz, lütfen tekrar giriş yapın',
    );
  }
}
