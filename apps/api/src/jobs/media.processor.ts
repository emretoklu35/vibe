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
import { MEDIA_QUEUE, PROCESS_PHOTO, type ProcessPhotoJob } from '../infra/queue/queues.js';
import { PhotoProcessingService } from '../modules/media/photo-processing.service.js';

/** Fotoğraf işleme kuyruğu: EXIF temizleme, yeniden kodlama, denetim. */
@Injectable()
export class MediaProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MediaProcessor.name);
  private connection?: Redis;
  private worker?: Worker;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly photos: PhotoProcessingService,
  ) {}

  onApplicationBootstrap(): void {
    this.connection = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: null });
    this.worker = new Worker(MEDIA_QUEUE, (job: Job<ProcessPhotoJob>) => this.process(job), {
      connection: this.connection,
      // sharp CPU yoğun; aynı anda az sayıda görsel işlenir.
      concurrency: 2,
    });
    this.worker.on('error', (error) => this.logger.error({ err: error }, 'Worker hatası'));
    this.worker.on('failed', (job, error) =>
      this.logger.error({ err: error, jobId: job?.id }, 'Fotoğraf işi başarısız'),
    );
    this.logger.log(`"${MEDIA_QUEUE}" kuyruğu dinleniyor`);
  }

  async process(job: Job<ProcessPhotoJob>): Promise<string> {
    if (job.name !== PROCESS_PHOTO) throw new Error(`Bilinmeyen iş: ${job.name}`);
    return this.photos.process(job.data.photoId);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit().catch(() => this.connection?.disconnect());
  }
}
