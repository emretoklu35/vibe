import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { errors, jwtVerify, SignJWT } from 'jose';

import { AppException } from '../../../common/errors/app.exception.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { APP_CONFIG } from '../../../config/config.module.js';
import type { AppConfig } from '../../../config/env.js';
import type { AdminRole } from '../../../generated/prisma/enums.js';
import { SecretBoxService } from '../../../infra/crypto/secret-box.service.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { AuditService } from '../audit.service.js';
import { DUMMY_HASH, verifyPassword } from './password.js';
import { verifyTotp } from './totp.js';

export const TOTP_PURPOSE = 'admin-totp';
const ISSUER = 'vibe-api';
const AUDIENCE = 'vibe-admin';
const SESSION_HOURS = 8;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type AdminContext = { adminId: string; sessionId: string; role: AdminRole; email: string };

const loginFailed = () =>
  new AppException(
    HttpStatus.UNAUTHORIZED,
    ErrorCode.ADMIN_LOGIN_FAILED,
    'E-posta, parola veya doğrulama kodu hatalı',
  );

/**
 * Yönetici girişi: e-posta + argon2id parola + TOTP (üçü birlikte; hangisinin yanlış olduğu söylenmez).
 * 5 hatalı denemede hesap 15 dk kilitlenir. Oturum token'ı kullanıcı token'larından ayrı anahtar ve
 * audience ile imzalanır; kullanıcı token'ı yönetim uçlarında geçmez (tersi de).
 */
@Injectable()
export class AdminAuthService {
  private readonly secret: Uint8Array;

  constructor(
    private readonly prisma: PrismaService,
    private readonly secretBox: SecretBoxService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.secret = new Uint8Array(config.JWT_ADMIN_SECRET);
  }

  async login(
    email: string,
    password: string,
    code: string,
    ip?: string,
  ): Promise<{
    token: string;
    expiresAt: Date;
    admin: { id: string; email: string; role: AdminRole };
  }> {
    const normalized = email.trim().toLowerCase();
    const admin = await this.prisma.adminUser.findUnique({ where: { email: normalized } });

    // Hesap yoksa da parola doğrulaması çalıştırılır: yanıt süresinden hesap varlığı anlaşılmasın.
    const passwordOk = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !admin.isActive) throw loginFailed();

    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ADMIN_LOCKED,
        'Çok fazla hatalı deneme; hesap geçici olarak kilitlendi',
        { lockedUntil: admin.lockedUntil },
      );
    }

    const totpOk = verifyTotp(
      this.secretBox.decrypt(TOTP_PURPOSE, admin.totpSecretEncrypted),
      code,
    );
    if (!passwordOk || !totpOk) {
      const failed = admin.failedLogins + 1;
      await this.prisma.adminUser.update({
        where: { id: admin.id },
        data: {
          failedLogins: failed >= MAX_FAILED ? 0 : failed,
          lockedUntil:
            failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : admin.lockedUntil,
        },
      });
      await this.audit.record(
        admin.id,
        'admin.login_failed',
        'admin',
        admin.id,
        { locked: failed >= MAX_FAILED },
        ip,
      );
      throw loginFailed();
    }

    const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
    const [session] = await this.prisma.$transaction([
      this.prisma.adminSession.create({
        data: { adminId: admin.id, expiresAt, ipAddress: ip?.slice(0, 64) },
      }),
      this.prisma.adminUser.update({
        where: { id: admin.id },
        data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
      }),
    ]);
    await this.audit.record(admin.id, 'admin.login', 'admin', admin.id, undefined, ip);

    const token = await new SignJWT({ sid: session.id, role: admin.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(admin.id)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.secret);
    return { token, expiresAt, admin: { id: admin.id, email: admin.email, role: admin.role } };
  }

  async authenticate(token: string): Promise<AdminContext> {
    let adminId: string;
    let sessionId: string;
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string')
        throw new Error('eksik talep');
      adminId = payload.sub;
      sessionId = payload.sid;
    } catch (error) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        error instanceof errors.JWTExpired ? ErrorCode.TOKEN_EXPIRED : ErrorCode.TOKEN_INVALID,
        'Yönetici oturumu geçersiz',
      );
    }
    const session = await this.prisma.adminSession.findUnique({
      where: { id: sessionId },
      select: {
        adminId: true,
        revokedAt: true,
        expiresAt: true,
        admin: { select: { isActive: true, role: true, email: true } },
      },
    });
    if (
      !session ||
      session.adminId !== adminId ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.admin.isActive
    ) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.SESSION_REVOKED,
        'Yönetici oturumu sonlandırılmış',
      );
    }
    // Rol her istekte DB'den okunur: rol değişikliği token süresini beklemeden geçerli olur.
    return { adminId, sessionId, role: session.admin.role, email: session.admin.email };
  }

  async logout(context: AdminContext, ip?: string): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { id: context.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record(
      context.adminId,
      'admin.logout',
      'admin',
      context.adminId,
      undefined,
      ip,
    );
  }
}
