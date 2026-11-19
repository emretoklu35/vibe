import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS } from '../../infra/redis/redis.module.js';

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Pencerenin sıfırlanmasına kalan süre (saniye, yukarı yuvarlanmış). */
  resetSeconds: number;
};

// Sabit pencere: ilk istekte sayaç süreyle oluşturulur; INCR + PEXPIRE atomik.
const CONSUME_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

/** Telefon numarası gibi kişisel veriler Redis anahtarına düz yazılmaz. */
export function rateLimitKey(bucket: string, identifier: string): string {
  const digest = createHash('sha256').update(identifier).digest('base64url').slice(0, 32);
  return `rl:${bucket}:${digest}`;
}

@Injectable()
export class RateLimiterService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async consume(
    bucket: string,
    identifier: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const raw = (await this.redis.eval(
      CONSUME_SCRIPT,
      1,
      rateLimitKey(bucket, identifier),
      String(windowSeconds * 1000),
    )) as [number, number];
    const [count, ttlMs] = raw;
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
    };
  }
}
