import { parseEnv } from './env.js';

const key = (len: number) => Buffer.alloc(len, 1).toString('base64');

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379/0',
  S3_BUCKET: 'vibe-test',
  S3_ACCESS_KEY_ID: 'k',
  S3_SECRET_ACCESS_KEY: 's',
  PHONE_HMAC_KEY: key(32),
  PHONE_ENCRYPTION_KEY: key(32),
  JWT_ACCESS_SECRET: key(32),
};

describe('parseEnv', () => {
  it('varsayılanları uygular', () => {
    const config = parseEnv(base);
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      SWAGGER_ENABLED: false,
      TRUST_PROXY_HOPS: 0,
    });
  });

  it('sayı ve boolean dizelerini dönüştürür', () => {
    const config = parseEnv({ ...base, PORT: '8080', SWAGGER_ENABLED: 'true' });
    expect(config.PORT).toBe(8080);
    expect(config.SWAGGER_ENABLED).toBe(true);
  });

  it('eksik zorunlu değişkeni adıyla bildirir', () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('yanlış protokolü reddeder', () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('"yes" gibi belirsiz boolean değerleri reddeder', () => {
    expect(() => parseEnv({ ...base, SWAGGER_ENABLED: 'yes' })).toThrow(/SWAGGER_ENABLED/);
  });

  it("production'da Swagger açılamaz", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })).toThrow(
      /Swagger/,
    );
  });

  it('CORS kaynaklarını listeye çevirir, varsayılanı boş', () => {
    expect(parseEnv(base).CORS_ORIGINS).toEqual([]);
    expect(
      parseEnv({ ...base, CORS_ORIGINS: 'http://localhost:8081, https://admin.example.com' })
        .CORS_ORIGINS,
    ).toEqual(['http://localhost:8081', 'https://admin.example.com']);
  });

  it("production'da http CORS kaynağını reddeder", () => {
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', CORS_ORIGINS: 'http://localhost:8081' }),
    ).toThrow(/CORS_ORIGINS/);
  });
});
