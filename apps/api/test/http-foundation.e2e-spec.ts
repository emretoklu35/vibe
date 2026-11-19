import type { NestExpressApplication } from '@nestjs/platform-express';
import { Redis } from 'ioredis';
import request from 'supertest';

import { REDIS } from '../src/infra/redis/redis.module.js';
import { createTestApp } from './support/create-test-app.js';

describe('HTTP temel katmanı', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    // Rate limit sayaçları testler arasında sızmasın (yalnızca test Redis DB'si).
    await app.get<Redis>(REDIS).flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('sağlık', () => {
    it('GET /api/v1/health/live → 200 ve standart zarf', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
      expect(res.body).toEqual({ data: { status: 'ok' } });
    });

    it('GET /api/v1/health/ready → PostgreSQL ve Redis ayakta', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
      expect(res.body).toEqual({
        data: { status: 'ok', checks: { database: 'up', redis: 'up' } },
      });
    });

    it('sürümsüz yol yoktur (/api/health/live → 404)', async () => {
      await request(app.getHttpServer()).get('/api/health/live').expect(404);
    });
  });

  describe('istek kimliği', () => {
    it('her yanıta x-request-id ekler', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health/live');
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('güvenli biçimdeki gelen kimliği korur', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('x-request-id', 'mobile-req-12345');
      expect(res.headers['x-request-id']).toBe('mobile-req-12345');
    });

    it('güvensiz gelen kimliği yenisiyle değiştirir', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('x-request-id', 'abc" INFO sahte-log <script>');
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('hata biçimi', () => {
    it('bilinmeyen yol → 404 NOT_FOUND ve requestId', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/yok').expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.requestId).toBe(res.headers['x-request-id']);
    });

    it('bozuk JSON → 400 BAD_REQUEST, ayrıştırıcı ayrıntısı sızmaz, requestId dolu', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/__test/echo')
        .set('content-type', 'application/json')
        .send('{bozuk')
        .expect(400);
      expect(res.body.error).toEqual({
        code: 'BAD_REQUEST',
        message: 'İstek gövdesi geçerli JSON değil',
      });
      expect(res.body.requestId).toBeTruthy();
      expect(res.body.requestId).toBe(res.headers['x-request-id']);
    });

    it('beklenmeyen hata → 500 INTERNAL_ERROR, iç mesaj istemciye gitmez', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/__test/boom').expect(500);
      expect(res.body.error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Beklenmeyen bir hata oluştu',
      });
      expect(JSON.stringify(res.body)).not.toContain('parola');
    });
  });

  describe('doğrulama', () => {
    it('geçerli gövdeyi dönüştürüp kabul eder', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/__test/echo')
        .send({ age: 30, nested: { label: 'abc' } })
        .expect(201);
      expect(res.body).toEqual({ data: { age: 30, nested: { label: 'abc' } } });
    });

    it('alan hatalarını VALIDATION_FAILED ile listeler (iç içe alanlar dahil), değeri geri yazmaz', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/__test/echo')
        .send({ age: 12, nested: { label: 'cok-uzun-etiket' } })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      const fields = (res.body.error.details as { field: string }[]).map((d) => d.field);
      expect(fields).toEqual(expect.arrayContaining(['age', 'nested.label']));
      expect(JSON.stringify(res.body)).not.toContain('cok-uzun-etiket');
    });

    it('beyan edilmemiş alanları reddeder', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/__test/echo')
        .send({ age: 30, nested: { label: 'a' }, isAdmin: true })
        .expect(400);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'isAdmin' })]),
      );
    });
  });

  describe('rate limit', () => {
    it('sınır aşılınca 429 RATE_LIMITED + Retry-After döner', async () => {
      const server = app.getHttpServer();
      const first = await request(server).get('/api/v1/__test/limited').expect(200);
      expect(first.headers['ratelimit-remaining']).toBe('1');
      await request(server).get('/api/v1/__test/limited').expect(200);

      const blocked = await request(server).get('/api/v1/__test/limited').expect(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(60);
    });

    it('Redis anahtarında ham tanımlayıcı (IP) bulunmaz', async () => {
      await request(app.getHttpServer()).get('/api/v1/__test/limited').expect(200);
      const keys = await app.get<Redis>(REDIS).keys('rl:*');
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) expect(key).not.toMatch(/127\.0\.0\.1|::1|ffff/);
    });
  });

  describe('Swagger', () => {
    it('OpenAPI belgesi sağlık uçlarını içerir', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
      expect(Object.keys(res.body.paths)).toEqual(
        expect.arrayContaining(['/api/v1/health/live', '/api/v1/health/ready']),
      );
    });
  });
});
