import { Module } from '@nestjs/common';

import { LoggingModule } from './common/logging/logging.module.js';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { ConfigModule } from './config/config.module.js';
import { CryptoModule } from './infra/crypto/crypto.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { QueueModule } from './infra/queue/queue.module.js';
import { StorageModule } from './infra/storage/storage.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { PrivacyModule } from './modules/privacy/privacy.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    RedisModule,
    CryptoModule,
    StorageModule,
    QueueModule,
    // Sıra önemli: global guard'lar modül sırasıyla çalışır. Kimlik doğrulama önce gelir ki
    // rate limit kullanıcı başına sayaç tutabilsin. Açık (public) uçlar IP başına sınırlanmaya devam eder;
    // geçersiz token'lar DB'ye gitmeden imza doğrulamasında reddedilir.
    AuthModule,
    RateLimitModule,
    UsersModule,
    PrivacyModule,
    ProfilesModule,
    MediaModule,
    HealthModule,
  ],
})
export class AppModule {}
