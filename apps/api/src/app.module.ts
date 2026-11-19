import { Module } from '@nestjs/common';

import { LoggingModule } from './common/logging/logging.module.js';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [ConfigModule, LoggingModule, PrismaModule, RedisModule, RateLimitModule, HealthModule],
})
export class AppModule {}
