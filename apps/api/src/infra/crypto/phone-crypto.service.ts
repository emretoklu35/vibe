import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';

const CIPHER_VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Telefon numarası için üç işlem:
 * - hash: arama/tekillik (deterministik HMAC; anahtar olmadan tersine çevrilemez, tahmin edilemez)
 * - encrypt/decrypt: SMS göndermek için geri çözülebilir saklama (AES-256-GCM, rastgele IV)
 * - otpHash: doğrulama kodunun özeti (HKDF ile ayrı anahtar)
 */
@Injectable()
export class PhoneCryptoService {
  private readonly hmacKey: Buffer;
  private readonly encryptionKey: Buffer;
  private readonly otpKey: Buffer;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.hmacKey = config.PHONE_HMAC_KEY;
    this.encryptionKey = config.PHONE_ENCRYPTION_KEY;
    this.otpKey = Buffer.from(
      hkdfSync('sha256', config.PHONE_HMAC_KEY, Buffer.alloc(0), 'vibe:otp:v1', 32),
    );
  }

  hash(e164: string): string {
    return createHmac('sha256', this.hmacKey).update(e164).digest('base64url');
  }

  encrypt(e164: string): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(e164, 'utf8'), cipher.final()]);
    return Buffer.concat([Buffer.from([CIPHER_VERSION]), iv, cipher.getAuthTag(), ciphertext]);
  }

  decrypt(payload: Uint8Array): string {
    const data = Buffer.from(payload);
    if (data[0] !== CIPHER_VERSION) throw new Error('Bilinmeyen telefon şifreleme sürümü');
    const iv = data.subarray(1, 1 + IV_LENGTH);
    const tag = data.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
    const ciphertext = data.subarray(1 + IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  /** Kod, telefon özetine bağlanır: bir numaranın kodu başka numarada geçmez. */
  otpHash(phoneHash: string, code: string): string {
    return createHmac('sha256', this.otpKey).update(`${phoneHash}:${code}`).digest('base64url');
  }

  safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
