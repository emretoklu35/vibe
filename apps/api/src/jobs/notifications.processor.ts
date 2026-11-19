import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { type Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.js';
import { NOTIFICATIONS_QUEUE, SEND_PUSH, type SendPushJob } from '../infra/queue/queues.js';
import { PushDeliveryService } from '../modules/notifications/push/push-delivery.service.js';

@Injectable()
export class NotificationsProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private connection?: Redis;
  private worker?: Worker;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly delivery: PushDeliveryService,
  ) {}

  onApplicationBootstrap(): void {
    this.connection = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: null });
    this.worker = new Worker(
      NOTIFICATIONS_QUEUE,
      async (job: Job<SendPushJob>) => {
        if (job.name !== SEND_PUSH) throw new Error(`Bilinmeyen iş: ${job.name}`);
        return this.delivery.deliver(job.data);
      },
      { connection: this.connection, concurrency: 5 },
    );
    this.worker.on('error', (error) => this.logger.error({ err: error }, 'Worker hatası'));
    this.logger.log(`"${NOTIFICATIONS_QUEUE}" kuyruğu dinleniyor`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit().catch(() => this.connection?.disconnect());
  }
}
