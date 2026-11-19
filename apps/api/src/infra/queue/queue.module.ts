import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { MEDIA_QUEUE, NOTIFICATIONS_QUEUE } from './queues.js';

export const MEDIA_QUEUE_TOKEN = Symbol('MEDIA_QUEUE');
export const NOTIFICATIONS_QUEUE_TOKEN = Symbol('NOTIFICATIONS_QUEUE');
const QUEUE_CONNECTION = Symbol('QUEUE_CONNECTION');

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
} as const;

/** API tarafı: işleri kuyruğa ekler (işlemez). İşleyiciler worker sürecindedir. */
@Global()
@Module({
  providers: [
    {
      provide: QUEUE_CONNECTION,
      inject: [APP_CONFIG],
      // Üretici bağlantısı: HTTP isteği Redis yokken uzun süre beklemesin.
      useFactory: (config: AppConfig) =>
        new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2_000 }),
    },
    {
      provide: MEDIA_QUEUE_TOKEN,
      inject: [QUEUE_CONNECTION],
      useFactory: (connection: Redis) => new Queue(MEDIA_QUEUE, { connection, defaultJobOptions }),
    },
    {
      provide: NOTIFICATIONS_QUEUE_TOKEN,
      inject: [QUEUE_CONNECTION],
      useFactory: (connection: Redis) =>
        new Queue(NOTIFICATIONS_QUEUE, { connection, defaultJobOptions }),
    },
  ],
  exports: [MEDIA_QUEUE_TOKEN, NOTIFICATIONS_QUEUE_TOKEN],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Inject(MEDIA_QUEUE_TOKEN) private readonly media: Queue,
    @Inject(NOTIFICATIONS_QUEUE_TOKEN) private readonly notifications: Queue,
    @Inject(QUEUE_CONNECTION) private readonly connection: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.media.close(), this.notifications.close()]);
    await this.connection.quit().catch(() => this.connection.disconnect());
  }
}
