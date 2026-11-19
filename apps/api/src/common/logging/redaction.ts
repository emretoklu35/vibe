/**
 * Loglara asla düşmemesi gereken alanlar (brief §7: parola, token, özel mesaj, hassas kişisel veri).
 * pino `redact` yolları: `*` tek seviye joker karakterdir.
 * Not: `code` bilinçli olarak listede yok; hata nesnelerindeki `err.code` (ör. ECONNREFUSED) teşhis için gerekir.
 * İstek gövdeleri zaten loglanmaz (bkz. logging.module.ts serializers).
 */
export const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'otp',
  'otpCode',
  'phone',
  'phoneNumber',
  'lat',
  'lng',
  'latitude',
  'longitude',
  'body',
  'birthDate',
] as const;

export const REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
];

export const REDACTION_CENSOR = '[GİZLENDİ]';
