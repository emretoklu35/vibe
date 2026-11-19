import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';

const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Amaç bazlı alan şifreleme (AES-256-GCM). Her amaç ana şifreleme anahtarından HKDF ile türetilen
 * ayrı bir anahtar kullanır; bir amacın şifreli verisi diğerinin anahtarıyla çözülemez.
 */
@Injectable()
export class SecretBoxService {
  private readonly master: Buffer;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.master = config.PHONE_ENCRYPTION_KEY;
  }

  encrypt(purpose: string, plaintext: Buffer): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key(purpose), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ciphertext]);
  }

  decrypt(purpose: string, payload: Uint8Array): Buffer {
    const data = Buffer.from(payload);
    if (data[0] !== VERSION) throw new Error('Bilinmeyen şifreleme sürümü');
    const iv = data.subarray(1, 1 + IV_LENGTH);
    const tag = data.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', this.key(purpose), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(data.subarray(1 + IV_LENGTH + TAG_LENGTH)),
      decipher.final(),
    ]);
  }

  private key(purpose: string): Buffer {
    return Buffer.from(hkdfSync('sha256', this.master, Buffer.alloc(0), `vibe:${purpose}:v1`, 32));
  }
}
