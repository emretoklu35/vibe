import type {
  PushMessage,
  PushOutcome,
  PushSender,
  PushTarget,
} from '../../src/modules/notifications/push/push-sender.js';

/** Testlerde gönderilen push'ları kaydeder; belirli token'lar için "geçersiz" yanıtı verebilir. */
export class PushRecorder implements PushSender {
  readonly sent: { target: PushTarget; message: PushMessage }[] = [];
  readonly invalidTokens = new Set<string>();

  send(target: PushTarget, message: PushMessage): Promise<PushOutcome> {
    if (this.invalidTokens.has(target.pushToken)) return Promise.resolve('invalid');
    this.sent.push({ target, message });
    return Promise.resolve('sent');
  }
}
