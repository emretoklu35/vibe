import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { type Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.js';
import {
  CLEANUP_STALE_UPLOADS,
  MAINTENANCE_QUEUE,
  PURGE_DELETED_ACCOUNTS,
} from '../infra/queue/queues.js';
import { PhotoProcessingService } from '../modules/media/photo-processing.service.js';
import { AccountDeletionService } from '../modules/users/account-deletion.service.js';

const PURGE_EVERY_MS = 15 * 60 * 1000;
const CLEANUP_EVERY_MS = 30 * 60 * 1000;

/**
 * Periyodik bakım işleri. BullMQ job scheduler sayesinde birden fazla worker çalışsa da
 * her periyotta iş bir kez kuyruğa girer.
 */
@Injectable()
export class MaintenanceProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceProcessor.name);
  private connection?: Redis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly deletion: AccountDeletionService,
    private readonly photos: PhotoProcessingService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // BullMQ worker bağlantısı maxRetriesPerRequest: null gerektirir.
    this.connection = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: null });
    this.queue = new Queue(MAINTENANCE_QUEUE, { connection: this.connection });
    await this.queue.upsertJobScheduler(
      PURGE_DELETED_ACCOUNTS,
      { every: PURGE_EVERY_MS },
      {
        name: PURGE_DELETED_ACCOUNTS,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      },
    );

    await this.queue.upsertJobScheduler(
      CLEANUP_STALE_UPLOADS,
      { every: CLEANUP_EVERY_MS },
      {
        name: CLEANUP_STALE_UPLOADS,
        opts: { attempts: 2, removeOnComplete: 100, removeOnFail: 500 },
      },
    );

    this.worker = new Worker(MAINTENANCE_QUEUE, (job) => this.process(job), {
      connection: this.connection,
      concurrency: 1,
    });
    this.worker.on('error', (error) => this.logger.error({ err: error }, 'Worker hatası'));
    this.worker.on('failed', (job, error) =>
      this.logger.error({ err: error, job: job?.name }, 'İş başarısız'),
    );
    this.logger.log(`"${MAINTENANCE_QUEUE}" kuyruğu dinleniyor`);
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case PURGE_DELETED_ACCOUNTS:
        return this.deletion.purgeDue();
      case CLEANUP_STALE_UPLOADS:
        return this.photos.cleanupStaleUploads();
      default:
        throw new Error(`Bilinmeyen iş: ${job.name}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Çalışan iş bitene kadar bekler (graceful shutdown).
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit().catch(() => this.connection?.disconnect());
  }
}
