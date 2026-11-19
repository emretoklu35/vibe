import type { SmsSender } from '../../src/modules/auth/sms/sms-sender.js';

/** Testlerde SMS göndermek yerine son kodu numara başına saklar. */
export class SmsCapture implements SmsSender {
  private readonly codes = new Map<string, string>();
  sent = 0;

  sendOtp(e164: string, code: string): Promise<void> {
    this.codes.set(e164, code);
    this.sent += 1;
    return Promise.resolve();
  }

  lastCode(e164: string): string {
    const code = this.codes.get(e164);
    if (!code) throw new Error(`${e164} için kod gönderilmedi`);
    return code;
  }
}
