import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export type RateLimitPolicy = {
  /** Sayaç grubu, ör. "otp-phone". Farklı uçlar aynı grubu paylaşabilir. */
  bucket: string;
  limit: number;
  windowSeconds: number;
  /** Sayacın kime göre tutulacağı. Varsayılan: istemci IP'si. */
  key?: (req: Request) => string | undefined;
  /**
   * Redis'e ulaşılamazsa isteği reddet (true) ya da geçir (false).
   * SMS gönderimi gibi maliyetli/kötüye kullanılabilir uçlarda true olmalı.
   */
  failClosed?: boolean;
};

export const RATE_LIMIT_POLICIES = 'vibe:rate-limit-policies';
export const SKIP_RATE_LIMIT = 'vibe:skip-rate-limit';

/** Uca bir veya birden fazla sınır ekler (ör. hem IP hem telefon başına). */
export const RateLimit = (...policies: RateLimitPolicy[]) =>
  SetMetadata(RATE_LIMIT_POLICIES, policies);

/** Varsayılan IP sınırını devre dışı bırakır (yalnızca sağlık kontrolü gibi uçlar için). */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT, true);
