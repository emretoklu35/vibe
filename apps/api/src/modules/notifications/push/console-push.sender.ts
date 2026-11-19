import { Injectable, Logger } from '@nestjs/common';

import type { PushMessage, PushOutcome, PushSender, PushTarget } from './push-sender.js';

/** YALNIZCA GELİŞTİRME: gönderilecek bildirimi loga yazar. production'da seçilemez (env.ts). */
@Injectable()
export class ConsolePushSender implements PushSender {
  private readonly logger = new Logger('Push(console)');

  send(target: PushTarget, message: PushMessage): Promise<PushOutcome> {
    this.logger.log(
      `[GELİŞTİRME] ${target.platform} cihaz ${target.id.slice(0, 8)}… → "${message.title}" / "${message.body}" ${JSON.stringify(message.data)}`,
    );
    return Promise.resolve('sent');
  }
}
