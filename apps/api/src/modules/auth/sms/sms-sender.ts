/** SMS sağlayıcı soyutlaması. Gerçek sağlayıcı (açık karar #9) bu arayüzü uygular. */
export interface SmsSender {
  sendOtp(e164: string, code: string): Promise<void>;
}

export const SMS_SENDER = Symbol('SMS_SENDER');
