import { createHash, randomBytes } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { errors, jwtVerify, SignJWT } from 'jose';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';

const ISSUER = 'vibe-api';
const AUDIENCE = 'vibe-app';

export type AccessTokenClaims = { userId: string; sessionId: string };

@Injectable()
export class TokensService {
  private readonly secret: Uint8Array;
  readonly accessTtlSeconds: number;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.secret = new Uint8Array(config.JWT_ACCESS_SECRET);
    this.accessTtlSeconds = config.ACCESS_TOKEN_TTL_SECONDS;
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + this.accessTtlSeconds * 1000);
    const token = await new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.secret);
    return { token, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new Error('eksik talep');
      }
      return { userId: payload.sub, sessionId: payload.sid };
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        throw new AppException(
          HttpStatus.UNAUTHORIZED,
          ErrorCode.TOKEN_EXPIRED,
          'Oturum süresi doldu',
        );
      }
      throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.TOKEN_INVALID, 'Geçersiz oturum');
    }
  }

  /** Opak refresh token: 256 bit rastgele. DB'de yalnızca SHA-256 özeti tutulur. */
  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('base64url');
  }
}
