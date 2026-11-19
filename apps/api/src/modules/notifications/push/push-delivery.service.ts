import { Inject, Injectable, Logger } from '@nestjs/common';

import type { SendPushJob } from '../../../infra/queue/queues.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { DEFAULT_SETTINGS } from '../devices.service.js';
import { PUSH_SENDER, type PushMessage, type PushSender } from './push-sender.js';

const MESSAGES: Record<SendPushJob['kind'], Omit<PushMessage, 'data'>> = {
  NEW_MATCH: { title: 'Yeni bir eşleşmen var!', body: 'Hemen ilk mesajı gönder.' },
  NEW_MESSAGE: { title: 'Yeni mesaj', body: 'Bir eşleşmen sana yazdı.' },
};

export type DeliveryResult = {
  sent: number;
  disabled: number;
  skipped?: 'settings' | 'inactive' | 'no-devices';
};

/** Worker tarafı: tercih kontrolü, cihazlara gönderim, geçersiz token'ların devre dışı bırakılması. */
@Injectable()
export class PushDeliveryService {
  private readonly logger = new Logger(PushDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
  ) {}

  async deliver(job: SendPushJob): Promise<DeliveryResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: job.userId },
      select: {
        status: true,
        notificationSettings: { select: { newMatch: true, newMessage: true } },
        userDevices: {
          where: { disabledAt: null },
          select: { id: true, platform: true, pushToken: true },
        },
      },
    });
    if (!user || user.status !== 'ACTIVE') return { sent: 0, disabled: 0, skipped: 'inactive' };
    const settings = user.notificationSettings ?? DEFAULT_SETTINGS;
    if (
      (job.kind === 'NEW_MATCH' && !settings.newMatch) ||
      (job.kind === 'NEW_MESSAGE' && !settings.newMessage)
    ) {
      return { sent: 0, disabled: 0, skipped: 'settings' };
    }
    if (user.userDevices.length === 0) return { sent: 0, disabled: 0, skipped: 'no-devices' };

    const message: PushMessage = {
      ...MESSAGES[job.kind],
      data: {
        type: job.kind,
        ...(job.conversationId ? { conversationId: job.conversationId } : {}),
        ...(job.matchId ? { matchId: job.matchId } : {}),
      },
    };

    const result: DeliveryResult = { sent: 0, disabled: 0 };
    for (const device of user.userDevices) {
      const outcome = await this.sender.send(device, message);
      if (outcome === 'sent') result.sent += 1;
      if (outcome === 'invalid') {
        await this.prisma.userDevice.update({
          where: { id: device.id },
          data: { disabledAt: new Date() },
        });
        result.disabled += 1;
      }
      if (outcome === 'failed') this.logger.warn({ deviceId: device.id }, 'Push gönderilemedi');
    }
    return result;
  }
}
