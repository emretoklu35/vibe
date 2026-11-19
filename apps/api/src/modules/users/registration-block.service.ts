import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS } from '../../infra/redis/redis.module.js';

/** 18 yaş altı beyanından sonra aynı numarayla yeniden kayıt 30 gün engellenir. */
export const UNDERAGE_BLOCK_SECONDS = 30 * 24 * 60 * 60;

const blockKey = (phoneHash: string) => `reg-block:${phoneHash}`;

@Injectable()
export class RegistrationBlockService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async block(phoneHash: string): Promise<void> {
    await this.redis.set(blockKey(phoneHash), '1', 'EX', UNDERAGE_BLOCK_SECONDS);
  }

  /** Engel varsa kalan süreyi (saniye) döndürür. */
  async remainingSeconds(phoneHash: string): Promise<number | undefined> {
    const ttl = await this.redis.ttl(blockKey(phoneHash));
    return ttl > 0 ? ttl : undefined;
  }
}
