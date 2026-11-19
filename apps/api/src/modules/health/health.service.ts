import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { REDIS } from '../../infra/redis/redis.module.js';
import type { ReadinessChecksDto } from './health.dto.js';

const CHECK_TIMEOUT_MS = 1_500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`zaman aşımı (${ms} ms)`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async checkDependencies(): Promise<ReadinessChecksDto> {
    const [database, redis] = await Promise.allSettled([
      withTimeout(this.prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS),
      withTimeout(this.redis.ping(), CHECK_TIMEOUT_MS),
    ]);
    return {
      database: database.status === 'fulfilled' ? 'up' : 'down',
      redis: redis.status === 'fulfilled' ? 'up' : 'down',
    };
  }
}
