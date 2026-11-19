import { DEV_ONLY_KEY_PREFIX, parseEnv } from './env.js';

const devKey = (len: number) =>
  Buffer.concat([Buffer.from('dev-only-test'), Buffer.alloc(len)])
    .subarray(0, len)
    .toString('base64');
const realKey = (len: number) => Buffer.alloc(len, 7).toString('base64');

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost/db',
  REDIS_URL: 'redis://localhost',
  S3_BUCKET: 'vibe-test',
  S3_ACCESS_KEY_ID: 'k',
  S3_SECRET_ACCESS_KEY: 's',
  PHONE_HMAC_KEY: realKey(32),
  PHONE_ENCRYPTION_KEY: realKey(32),
  JWT_ACCESS_SECRET: realKey(48),
  JWT_ADMIN_SECRET: realKey(48),
};

describe('gizli anahtar doğrulaması', () => {
  it('geliştirme anahtarlarının öneki tanınır', () => {
    expect(devKey(32).startsWith(DEV_ONLY_KEY_PREFIX)).toBe(true);
  });

  it('şifreleme anahtarı tam 32 bayt olmalı', () => {
    expect(() => parseEnv({ ...base, PHONE_ENCRYPTION_KEY: realKey(16) })).toThrow(
      /PHONE_ENCRYPTION_KEY/,
    );
  });

  it('kısa JWT anahtarı reddedilir', () => {
    expect(() => parseEnv({ ...base, JWT_ACCESS_SECRET: realKey(16) })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it("production'da geliştirme anahtarı ve console SMS reddedilir", () => {
    const run = () =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        PHONE_HMAC_KEY: devKey(32),
        SMS_PROVIDER: 'console',
      });
    expect(run).toThrow(/PHONE_HMAC_KEY/);
    expect(run).toThrow(/SMS_PROVIDER/);
  });
});
