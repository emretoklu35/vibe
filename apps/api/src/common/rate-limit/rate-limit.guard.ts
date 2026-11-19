import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';
import {
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy,
  SKIP_RATE_LIMIT,
} from './rate-limit.decorator.js';
import { RateLimiterService, type RateLimitResult } from './rate-limiter.service.js';

/**
 * Global guard. Her istek varsayılan IP sınırına tabidir; uçlar @RateLimit ile ek sınır koyar.
 * En kısıtlayıcı sonuç RateLimit-* başlıklarına yazılır.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly defaultPolicy: RateLimitPolicy;

  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiterService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.defaultPolicy = {
      bucket: 'ip-default',
      limit: config.RATE_LIMIT_DEFAULT_PER_MINUTE,
      windowSeconds: 60,
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT, targets)) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const policies = [
      this.defaultPolicy,
      ...(this.reflector.getAllAndOverride<RateLimitPolicy[]>(RATE_LIMIT_POLICIES, targets) ?? []),
    ];

    let mostRestrictive: RateLimitResult | undefined;
    for (const policy of policies) {
      const identifier = policy.key ? policy.key(request) : request.ip;
      if (!identifier) continue;

      let result: RateLimitResult;
      try {
        result = await this.limiter.consume(
          policy.bucket,
          identifier,
          policy.limit,
          policy.windowSeconds,
        );
      } catch (error) {
        this.logger.error({ err: error, bucket: policy.bucket }, 'Rate limit sayacına ulaşılamadı');
        if (policy.failClosed) {
          throw new AppException(
            HttpStatus.SERVICE_UNAVAILABLE,
            ErrorCode.SERVICE_UNAVAILABLE,
            'Hizmet geçici olarak kullanılamıyor',
          );
        }
        continue;
      }

      if (!mostRestrictive || result.remaining < mostRestrictive.remaining) {
        mostRestrictive = result;
      }
      if (!result.allowed) {
        this.writeHeaders(response, result);
        response.setHeader('Retry-After', String(result.resetSeconds));
        throw new AppException(
          HttpStatus.TOO_MANY_REQUESTS,
          ErrorCode.RATE_LIMITED,
          'Çok fazla istek gönderildi, lütfen biraz sonra tekrar deneyin',
          { retryAfterSeconds: result.resetSeconds },
        );
      }
    }

    if (mostRestrictive) this.writeHeaders(response, mostRestrictive);
    return true;
  }

  private writeHeaders(response: Response, result: RateLimitResult): void {
    response.setHeader('RateLimit-Limit', String(result.limit));
    response.setHeader('RateLimit-Remaining', String(result.remaining));
    response.setHeader('RateLimit-Reset', String(result.resetSeconds));
  }
}
