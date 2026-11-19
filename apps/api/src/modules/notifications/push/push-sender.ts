import type { Platform } from '../../../generated/prisma/enums.js';

/**
 * Push sağlayıcı soyutlaması (açık karar #11: doğrudan FCM/APNs). Gerçek gönderici bu arayüzü uygular.
 * Bildirim metni hiçbir zaman mesaj içeriği veya karşı tarafın adını içermez (kilit ekranı gizliliği).
 */
export type PushMessage = {
  title: string;
  body: string;
  data: Record<string, string>;
};

export type PushTarget = { id: string; platform: Platform; pushToken: string };

/** Sağlayıcının cevabı: "invalid" → token artık geçersiz (uygulama silinmiş vb.), cihaz devre dışı bırakılır. */
export type PushOutcome = 'sent' | 'invalid' | 'failed';

export interface PushSender {
  send(target: PushTarget, message: PushMessage): Promise<PushOutcome>;
}

export const PUSH_SENDER = Symbol('PUSH_SENDER');
