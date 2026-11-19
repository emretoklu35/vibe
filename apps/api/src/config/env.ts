import { z } from 'zod';

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
