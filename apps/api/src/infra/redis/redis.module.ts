import { Global, Inject, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: async (config: AppConfig): Promise<Redis> => {
        const logger = new Logger('Redis');
        const client = new Redis(config.REDIS_URL, {
          // Bağlantı yokken komutlar kuyrukta beklemesin; çağıran hemen hata alsın.
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 2_000,
          lazyConnect: true,
        });
        // Bağlantı adresi parola içerebilir; yalnızca hata mesajı loglanır.
        client.on('error', (error: Error) =>
          logger.warn(`Redis bağlantı hatası: ${error.message}`),
        );
        // Açılışta bağlantı kurulmasını bekle ki ilk istekler reddedilmesin. Redis kapalıysa
        // uygulama yine açılır: /health/ready bunu raporlar, ioredis arka planda yeniden dener.
        try {
          await client.connect();
        } catch (error) {
          logger.error(`Redis'e açılışta bağlanılamadı: ${(error as Error).message}`);
        }
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
