import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimiterService } from './rate-limiter.service.js';

@Module({
  providers: [RateLimiterService, { provide: APP_GUARD, useClass: RateLimitGuard }],
  exports: [RateLimiterService],
})
export class RateLimitModule {}
