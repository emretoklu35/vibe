import { Injectable, Logger } from '@nestjs/common';

import { maskPhone } from '../phone.js';
import type { SmsSender } from './sms-sender.js';

/**
 * Yalnızca geliştirme: SMS göndermez, kodu API loguna yazar.
 * Production'da seçilemez (bkz. env.ts — SMS_PROVIDER kontrolü).
 */
@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS(console)');

  sendOtp(e164: string, code: string): Promise<void> {
    this.logger.warn(`[GELİŞTİRME] ${maskPhone(e164)} için doğrulama kodu: ${code}`);
    return Promise.resolve();
  }
}
