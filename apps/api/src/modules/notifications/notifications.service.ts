import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { NOTIFICATIONS_QUEUE_TOKEN } from '../../infra/queue/queue.module.js';
import { SEND_PUSH, type SendPushJob } from '../../infra/queue/queues.js';
import { RealtimeService } from '../realtime/realtime.service.js';

/**
 * API tarafı bildirim kararı: kullanıcı uygulamada çevrimiçiyse (socket açık) push gönderilmez,
 * olay socket'ten zaten ulaşır. Değilse push işi kuyruğa alınır; tercih kontrolü ve gönderim worker'dadır.
 * Bildirim gönderilememesi asıl işlemi (mesaj, eşleşme) asla bozmaz.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATIONS_QUEUE_TOKEN) private readonly queue: Queue,
    private readonly realtime: RealtimeService,
  ) {}

  async notify(job: SendPushJob): Promise<void> {
    try {
      if (await this.realtime.isOnline(job.userId)) return;
      await this.queue.add(SEND_PUSH, job);
    } catch (error) {
      this.logger.warn({ err: error, kind: job.kind }, 'Bildirim kuyruğa alınamadı');
    }
  }
}
