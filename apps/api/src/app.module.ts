import { Module } from '@nestjs/common';

import { LoggingModule } from './common/logging/logging.module.js';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { ConfigModule } from './config/config.module.js';
import { CryptoModule } from './infra/crypto/crypto.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrivacyModule } from './modules/privacy/privacy.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    RedisModule,
    CryptoModule,
    // Sıra önemli: global guard'lar modül sırasıyla çalışır. Rate limit, kimlik doğrulamadan önce
    // gelir; böylece geçersiz token denemeleri de sınırlanır.
    RateLimitModule,
    AuthModule,
    UsersModule,
    PrivacyModule,
    HealthModule,
  ],
})
export class AppModule {}
