import { randomInt } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PhoneCryptoService } from '../../infra/crypto/phone-crypto.service.js';
import { REDIS } from '../../infra/redis/redis.module.js';
import { SMS_SENDER, type SmsSender } from './sms/sms-sender.js';

export const OTP_TTL_SECONDS = 300;
export const OTP_MAX_ATTEMPTS = 5;
const OTP_LENGTH = 6;

const otpKey = (phoneHash: string) => `otp:${phoneHash}`;

/**
 * Tek kullanımlık SMS kodu. Kod Redis'te yalnızca HMAC özeti olarak durur (TTL 5 dk).
 * Yeni kod istemek eskisini geçersiz kılar; 5 yanlış denemede kod silinir.
 */
@Injectable()
export class OtpService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    private readonly crypto: PhoneCryptoService,
  ) {}

  async issue(e164: string): Promise<{ expiresInSeconds: number }> {
    const phoneHash = this.crypto.hash(e164);
    const code = randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');

    await this.redis
      .multi()
      .del(otpKey(phoneHash))
      .hset(otpKey(phoneHash), { h: this.crypto.otpHash(phoneHash, code), a: '0' })
      .expire(otpKey(phoneHash), OTP_TTL_SECONDS)
      .exec();

    await this.sms.sendOtp(e164, code);
    return { expiresInSeconds: OTP_TTL_SECONDS };
  }

  /** Doğruysa kodu tüketir (aynı kod ikinci kez kullanılamaz). Yanlışsa ilgili hatayı fırlatır. */
  async consume(e164: string, code: string): Promise<void> {
    const phoneHash = this.crypto.hash(e164);
    const key = otpKey(phoneHash);
    const stored = await this.redis.hget(key, 'h');

    if (!stored) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.OTP_EXPIRED,
        'Kodun süresi dolmuş, lütfen yeni kod isteyin',
      );
    }

    if (!this.crypto.safeEqual(stored, this.crypto.otpHash(phoneHash, code))) {
      const attempts = await this.redis.hincrby(key, 'a', 1);
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await this.redis.del(key);
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          ErrorCode.OTP_TOO_MANY_ATTEMPTS,
          'Çok fazla hatalı deneme, lütfen yeni kod isteyin',
        );
      }
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.OTP_INVALID, 'Kod hatalı', {
        attemptsLeft: OTP_MAX_ATTEMPTS - attempts,
      });
    }

    // Eşzamanlı iki doğru doğrulamadan yalnızca biri kazanır.
    const deleted = await this.redis.del(key);
    if (deleted !== 1) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.OTP_EXPIRED,
        'Kodun süresi dolmuş, lütfen yeni kod isteyin',
      );
    }
  }
}
