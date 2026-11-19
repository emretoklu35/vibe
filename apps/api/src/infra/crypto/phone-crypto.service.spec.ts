import { parseEnv } from '../../config/env.js';
import { PhoneCryptoService } from './phone-crypto.service.js';

const key = (seed: number, length = 32) =>
  Buffer.from(Array.from({ length }, (_, i) => (i * 31 + seed) % 256)).toString('base64');

function service(hmacSeed = 1, encSeed = 2) {
  const config = parseEnv({
    DATABASE_URL: 'postgresql://u:p@localhost/db',
    REDIS_URL: 'redis://localhost',
    S3_BUCKET: 'vibe-test',
    S3_ACCESS_KEY_ID: 'k',
    S3_SECRET_ACCESS_KEY: 's',
    PHONE_HMAC_KEY: key(hmacSeed),
    PHONE_ENCRYPTION_KEY: key(encSeed),
    JWT_ACCESS_SECRET: key(3),
  });
  return new PhoneCryptoService(config);
}

describe('PhoneCryptoService', () => {
  const phone = '+905321234567';

  it('şifreleme geri çözülebilir, şifreli veride numara görünmez', () => {
    const crypto = service();
    const encrypted = crypto.encrypt(phone);
    expect(encrypted.toString('utf8')).not.toContain('5321234567');
    expect(crypto.decrypt(encrypted)).toBe(phone);
  });

  it('aynı numara her şifrelemede farklı çıktı verir (rastgele IV)', () => {
    const crypto = service();
    expect(crypto.encrypt(phone).equals(crypto.encrypt(phone))).toBe(false);
  });

  it('değiştirilmiş şifreli veri reddedilir (GCM bütünlüğü)', () => {
    const crypto = service();
    const encrypted = crypto.encrypt(phone);
    encrypted.writeUInt8(encrypted.readUInt8(encrypted.length - 1) ^ 0xff, encrypted.length - 1);
    expect(() => crypto.decrypt(encrypted)).toThrow();
  });

  it('özet deterministik, anahtara bağlı ve numarayı içermez', () => {
    expect(service().hash(phone)).toBe(service().hash(phone));
    expect(service(9).hash(phone)).not.toBe(service().hash(phone));
    expect(service().hash(phone)).not.toContain('5321234567');
  });

  it('OTP özeti numaraya bağlıdır', () => {
    const crypto = service();
    expect(crypto.otpHash('a', '123456')).not.toBe(crypto.otpHash('b', '123456'));
  });
});
