import type { NestExpressApplication } from '@nestjs/platform-express';
import { Redis } from 'ioredis';
import request from 'supertest';

import { REDIS } from '../src/infra/redis/redis.module.js';
import { createTestApp } from './support/create-test-app.js';

describe('Redis kullanılamazken', () => {
  let app: NestExpressApplication;
  let deadRedis: Redis;

  beforeAll(async () => {
    // Kapalı bir porta bağlanmaya çalışan istemci: her komut hemen hata verir.
    deadRedis = new Redis('redis://127.0.0.1:1', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    deadRedis.on('error', () => undefined);
    app = await createTestApp([{ token: REDIS, useValue: deadRedis }]);
  });

  afterAll(async () => {
    await app.close();
    deadRedis.disconnect();
  });

  it('hazır olma kontrolü 503 SERVICE_UNAVAILABLE döner ve hangi bağımlılığın düştüğünü söyler', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.error.details).toEqual({ checks: { database: 'up', redis: 'down' } });
  });

  it('varsayılan rate limit açık kalır (fail-open): uç çalışmaya devam eder', async () => {
    await request(app.getHttpServer()).get('/api/v1/__test/limited').expect(200);
  });

  it('failClosed politikalı uç isteği reddeder (ör. SMS gönderimi)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/__test/fail-closed').expect(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
