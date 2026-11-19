import { z } from 'zod';

/** base64 ile kodlanmış, en az `min` bayt uzunluğunda gizli anahtar. */
const base64Key = (min: number, exact?: number) =>
  z
    .string()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'base64 olmalı')
    .transform((value) => Buffer.from(value, 'base64'))
    .refine((buf) => (exact ? buf.length === exact : buf.length >= min), {
      message: exact ? `tam ${exact} bayt olmalı` : `en az ${min} bayt olmalı`,
    });

/** .env.example'daki yalnızca-geliştirme anahtarları; production'da kullanılırsa uygulama başlamaz. */
export const DEV_ONLY_KEY_PREFIX = 'ZGV2LW9ubHk';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    SWAGGER_ENABLED: booleanString.default(false),
    /** Önündeki güvenilir proxy sayısı (load balancer). 0 = doğrudan bağlantı. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    /** Varsayılan IP başına dakikalık istek sınırı. */
    RATE_LIMIT_DEFAULT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
    /** Telefon numarası özeti (HMAC) ve ondan türetilen OTP özeti anahtarı. ≥ 32 bayt. */
    PHONE_HMAC_KEY: base64Key(32),
    /** Telefon numarası şifreleme anahtarı (AES-256-GCM). Tam 32 bayt. */
    PHONE_ENCRYPTION_KEY: base64Key(32, 32),
    /** Access token (HS256) imza anahtarı. ≥ 32 bayt. */
    JWT_ACCESS_SECRET: base64Key(32),
    /** Yönetim paneli oturum token'ı (HS256) imza anahtarı; kullanıcı anahtarından ayrıdır. ≥ 32 bayt. */
    JWT_ADMIN_SECRET: base64Key(32),
    /** 5651 erişim kaydı saklama süresi (gün). Hukuki teyit: açık karar #17. */
    ACCESS_LOG_RETENTION_DAYS: z.coerce.number().int().min(365).max(3650).default(730),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** SMS sağlayıcısı. Şimdilik yalnızca `console` (kodu loga yazar; production'da yasak). */
    SMS_PROVIDER: z.enum(['console']).default('console'),
    /** S3 uyumlu nesne depolama. S3_ENDPOINT boşsa AWS S3 kullanılır. */
    S3_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
    /** İstemcilere verilen presigned URL'lerin adresi (ör. Android emülatörü için 10.0.2.2). Boşsa S3_ENDPOINT. */
    S3_PUBLIC_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
    S3_REGION: z.string().min(1).default('eu-central-1'),
    S3_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'geçerli bir bucket adı olmalı'),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: booleanString.default(false),
    /** Yalnızca geliştirme: bucket yoksa açılışta oluşturur ve CORS_ORIGINS için CORS ayarlar. */
    S3_AUTO_CREATE_BUCKET: booleanString.default(false),
    /** Fotoğraf denetim sağlayıcısı. Şimdilik yalnızca `dev-auto-approve` (production'da yasak, K8). */
    MODERATION_PROVIDER: z.enum(['dev-auto-approve']).default('dev-auto-approve'),
    /** Push sağlayıcısı. Şimdilik yalnızca `console` (bildirimi loga yazar; production'da yasak, açık karar #11). */
    PUSH_PROVIDER: z.enum(['console']).default('console'),
    /** Bu sürümün altındaki mobil uygulamalar güncellemeye zorlanır. */
    APP_MIN_VERSION: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, 'x.y.z biçiminde olmalı')
      .default('0.1.0'),
    /**
     * Tarayıcıdan erişime izin verilen kaynaklar (virgülle ayrılmış). Boş = CORS kapalı.
     * Mobil uygulama tarayıcı olmadığından buna ihtiyaç duymaz; yalnızca web önizleme / admin paneli.
     */
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url({ protocol: /^https?$/ }))),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.SWAGGER_ENABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['SWAGGER_ENABLED'],
        message: 'Swagger UI production ortamında açılamaz',
      });
    }
    if (env.NODE_ENV === 'production' && env.SMS_PROVIDER === 'console') {
      ctx.addIssue({
        code: 'custom',
        path: ['SMS_PROVIDER'],
        message:
          "production'da gerçek bir SMS sağlayıcısı gerekir (console yalnızca geliştirme içindir)",
      });
    }
    if (env.NODE_ENV === 'production' && env.MODERATION_PROVIDER === 'dev-auto-approve') {
      ctx.addIssue({
        code: 'custom',
        path: ['MODERATION_PROVIDER'],
        message: "production'da gerçek bir fotoğraf denetim sağlayıcısı gerekir",
      });
    }
    if (env.NODE_ENV === 'production' && env.PUSH_PROVIDER === 'console') {
      ctx.addIssue({
        code: 'custom',
        path: ['PUSH_PROVIDER'],
        message: "production'da gerçek bir push sağlayıcısı (FCM/APNs) gerekir",
      });
    }
    if (env.NODE_ENV === 'production' && env.S3_AUTO_CREATE_BUCKET) {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_AUTO_CREATE_BUCKET'],
        message: "production'da bucket altyapı tarafından oluşturulmalı",
      });
    }
    if (env.NODE_ENV === 'production') {
      for (const key of [
        'PHONE_HMAC_KEY',
        'PHONE_ENCRYPTION_KEY',
        'JWT_ACCESS_SECRET',
        'JWT_ADMIN_SECRET',
      ] as const) {
        if (env[key].toString('base64').startsWith(DEV_ONLY_KEY_PREFIX)) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'geliştirme anahtarı production ortamında kullanılamaz',
          });
        }
      }
    }
    if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.some((o) => o.startsWith('http://'))) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: "production'da yalnızca https kaynaklarına izin verilir",
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

/** Ortam değişkenlerini doğrular; hata varsa hangi değişkenin neden geçersiz olduğunu söyler. */
export function parseEnv(source: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(kök)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Geçersiz ortam değişkenleri:\n${problems}`);
  }
  return result.data;
}
