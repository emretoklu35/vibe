import type { NestExpressApplication } from '@nestjs/platform-express';
import { Redis } from 'ioredis';
import { SignJWT } from 'jose';
import request from 'supertest';

import { APP_CONFIG } from '../src/config/config.module.js';
import type { AppConfig } from '../src/config/env.js';
import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { REDIS } from '../src/infra/redis/redis.module.js';
import { bearer, randomPhone, resetDatabase, signIn, smsOf } from './support/auth-helpers.js';
import { createTestApp } from './support/create-test-app.js';

describe('Auth: telefon OTP, oturumlar, token rotasyonu', () => {
  let app: NestExpressApplication;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);
  });

  beforeEach(async () => {
    await app.get<Redis>(REDIS).flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/otp/request', () => {
    it('geçersiz numara → 400 INVALID_PHONE, SMS gönderilmez', async () => {
      const before = smsOf(app).sent;
      const res = await request(server)
        .post('/api/v1/auth/otp/request')
        .send({ phone: '0212 123 45 67' })
        .expect(400);
      expect(res.body.error.code).toBe('INVALID_PHONE');
      expect(smsOf(app).sent).toBe(before);
    });

    it('202 döner ve 6 haneli kod gönderir', async () => {
      const phone = randomPhone();
      const res = await request(server)
        .post('/api/v1/auth/otp/request')
        .send({ phone })
        .expect(202);
      expect(res.body).toEqual({ data: { expiresInSeconds: 300 } });
      expect(smsOf(app).lastCode(phone)).toMatch(/^\d{6}$/);
    });

    it('aynı numaraya 60 sn içinde ikinci kod → 429 (farklı yazımla da)', async () => {
      const phone = randomPhone();
      await request(server).post('/api/v1/auth/otp/request').send({ phone }).expect(202);
      const local = `0${phone.slice(3)}`;
      const res = await request(server)
        .post('/api/v1/auth/otp/request')
        .send({ phone: local })
        .expect(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });

    it('Redis anahtarlarında telefon numarası düz yazılmaz', async () => {
      const phone = randomPhone();
      await request(server).post('/api/v1/auth/otp/request').send({ phone }).expect(202);
      const keys = await app.get<Redis>(REDIS).keys('*');
      for (const key of keys) expect(key).not.toContain(phone.slice(4));
    });
  });

  describe('POST /auth/otp/verify', () => {
    it('yeni numara → hesap oluşturulur, onboarding doğum tarihinden başlar', async () => {
      const session = await signIn(app);
      expect(session.isNew).toBe(true);
      const me = await request(server)
        .get('/api/v1/users/me')
        .set(bearer(session.accessToken))
        .expect(200);
      expect(me.body.data).toMatchObject({
        id: session.userId,
        status: 'ACTIVE',
        birthDate: null,
        onboardingStep: 'BIRTH_DATE',
      });
    });

    it('aynı numara farklı yazımla → aynı hesap, isNew=false', async () => {
      const phone = randomPhone();
      const first = await signIn(app, phone);
      await app.get<Redis>(REDIS).flushdb();
      const second = await signIn(app, `0${phone.slice(3, 6)} ${phone.slice(6)}`);
      expect(second.isNew).toBe(false);
      expect(second.userId).toBe(first.userId);
    });

    it('numara DB’de düz metin olarak tutulmaz', async () => {
      const session = await signIn(app);
      const user = await app
        .get(PrismaService)
        .user.findUniqueOrThrow({ where: { id: session.userId } });
      const digits = session.phone.slice(3);
      expect(user.phoneHash).not.toContain(digits);
      expect(Buffer.from(user.phoneEncrypted).toString('latin1')).not.toContain(digits);
    });

    it('yanlış kod → kalan deneme sayısı; 5. yanlışta kod silinir, doğru kod da artık geçmez', async () => {
      const phone = randomPhone();
      await request(server).post('/api/v1/auth/otp/request').send({ phone }).expect(202);
      const code = smsOf(app).lastCode(phone);
      const wrong = code === '000000' ? '111111' : '000000';

      const first = await request(server)
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: wrong })
        .expect(422);
      expect(first.body.error).toMatchObject({ code: 'OTP_INVALID', details: { attemptsLeft: 4 } });

      for (let i = 0; i < 3; i++) {
        await request(server)
          .post('/api/v1/auth/otp/verify')
          .send({ phone, code: wrong })
          .expect(422);
      }
      const fifth = await request(server)
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: wrong })
        .expect(422);
      expect(fifth.body.error.code).toBe('OTP_TOO_MANY_ATTEMPTS');

      const late = await request(server)
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code })
        .expect(422);
      expect(late.body.error.code).toBe('OTP_EXPIRED');
    });

    it('kod tek kullanımlıktır', async () => {
      const phone = randomPhone();
      await request(server).post('/api/v1/auth/otp/request').send({ phone }).expect(202);
      const code = smsOf(app).lastCode(phone);
      await request(server).post('/api/v1/auth/otp/verify').send({ phone, code }).expect(200);
      const again = await request(server)
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code })
        .expect(422);
      expect(again.body.error.code).toBe('OTP_EXPIRED');
    });

    it('bir numaraya gönderilen kod başka numarada geçmez', async () => {
      const [a, b] = [randomPhone(), randomPhone()];
      await request(server).post('/api/v1/auth/otp/request').send({ phone: a }).expect(202);
      await request(server).post('/api/v1/auth/otp/request').send({ phone: b }).expect(202);
      const res = await request(server)
        .post('/api/v1/auth/otp/verify')
        .send({ phone: b, code: smsOf(app).lastCode(a) });
      // Kodlar tesadüfen aynı olabilir (1/10^6); o durumda test anlamsızdır.
      if (smsOf(app).lastCode(a) !== smsOf(app).lastCode(b)) expect(res.status).toBe(422);
    });

    it('kod biçimi yanlışsa VALIDATION_FAILED', async () => {
      const res = await request(server)
        .post('/api/v1/auth/otp/verify')
        .send({ phone: randomPhone(), code: '12ab' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('korumalı uçlar', () => {
    it('token yok → 401 UNAUTHENTICATED', async () => {
      const res = await request(server).get('/api/v1/users/me').expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('bozuk token → 401 TOKEN_INVALID', async () => {
      const res = await request(server)
        .get('/api/v1/users/me')
        .set(bearer('abc.def.ghi'))
        .expect(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });

    it('başka anahtarla imzalanmış token → 401 TOKEN_INVALID', async () => {
      const session = await signIn(app);
      const forged = await new SignJWT({ sid: 'x' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(session.userId)
        .setIssuer('vibe-api')
        .setAudience('vibe-app')
        .setExpirationTime('5m')
        .sign(new TextEncoder().encode('baska-bir-gizli-anahtar-baska-bir-gizli-anahtar'));
      const res = await request(server).get('/api/v1/users/me').set(bearer(forged)).expect(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });

    it('süresi dolmuş token → 401 TOKEN_EXPIRED', async () => {
      const session = await signIn(app);
      const secret = new Uint8Array(app.get<AppConfig>(APP_CONFIG).JWT_ACCESS_SECRET);
      const { sessionId } = await decodeSid(session.accessToken);
      const expired = await new SignJWT({ sid: sessionId })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(session.userId)
        .setIssuer('vibe-api')
        .setAudience('vibe-app')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(secret);
      const res = await request(server).get('/api/v1/users/me').set(bearer(expired)).expect(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('refresh token rotasyonu', () => {
    it('yenileme yeni bir çift verir, yeni access token çalışır', async () => {
      const session = await signIn(app);
      const res = await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);
      expect(res.body.data.refreshToken).not.toBe(session.refreshToken);
      await request(server)
        .get('/api/v1/users/me')
        .set(bearer(res.body.data.accessToken))
        .expect(200);
    });

    it('eski refresh token tekrar kullanılırsa → REFRESH_TOKEN_REUSED ve tüm oturum iptal', async () => {
      const session = await signIn(app);
      const rotated = await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      const reuse = await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
      expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

      // Saldırganın elindeki eski token gibi, meşru kullanıcının yeni token'ı da artık geçmez.
      const legit = await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.body.data.refreshToken })
        .expect(401);
      expect(legit.body.error.code).toBe('REFRESH_TOKEN_INVALID');
      const me = await request(server)
        .get('/api/v1/users/me')
        .set(bearer(rotated.body.data.accessToken))
        .expect(401);
      expect(me.body.error.code).toBe('SESSION_REVOKED');
    });

    it('bilinmeyen refresh token → REFRESH_TOKEN_INVALID', async () => {
      const res = await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'bilinmeyen-token' })
        .expect(401);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('DB’de refresh token düz değil özet olarak tutulur', async () => {
      const session = await signIn(app);
      const rows = await app
        .get(PrismaService)
        .session.findMany({ where: { userId: session.userId } });
      for (const row of rows) {
        expect(row.refreshTokenHash).not.toBe(session.refreshToken);
      }
    });
  });

  describe('çıkış ve oturum yönetimi', () => {
    it('çıkış sonrası access ve refresh token geçersiz', async () => {
      const session = await signIn(app);
      await request(server)
        .post('/api/v1/auth/logout')
        .set(bearer(session.accessToken))
        .expect(204);
      const me = await request(server)
        .get('/api/v1/users/me')
        .set(bearer(session.accessToken))
        .expect(401);
      expect(me.body.error.code).toBe('SESSION_REVOKED');
      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
    });

    it('oturumları listeler, diğer cihazı kapatır; başkasının oturumu → 404', async () => {
      const phone = randomPhone();
      const phoneA = await signIn(app, phone);
      await app.get<Redis>(REDIS).flushdb();
      const phoneB = await signIn(app, phone);
      const stranger = await signIn(app);

      const list = await request(server)
        .get('/api/v1/auth/sessions')
        .set(bearer(phoneA.accessToken))
        .expect(200);
      expect(list.body.data).toHaveLength(2);
      const current = (list.body.data as { id: string; current: boolean }[]).find((s) => s.current);
      const other = (list.body.data as { id: string; current: boolean }[]).find((s) => !s.current);
      expect(current && other).toBeTruthy();

      const strangerSessions = await request(server)
        .get('/api/v1/auth/sessions')
        .set(bearer(stranger.accessToken))
        .expect(200);
      await request(server)
        .delete(`/api/v1/auth/sessions/${strangerSessions.body.data[0].id}`)
        .set(bearer(phoneA.accessToken))
        .expect(404);

      await request(server)
        .delete(`/api/v1/auth/sessions/${other!.id}`)
        .set(bearer(phoneA.accessToken))
        .expect(204);
      await request(server).get('/api/v1/users/me').set(bearer(phoneB.accessToken)).expect(401);
      await request(server).get('/api/v1/users/me').set(bearer(stranger.accessToken)).expect(200);
    });
  });

  describe('hesap durumu', () => {
    it('banlanan kullanıcının açık oturumu ve yeni girişi reddedilir', async () => {
      const session = await signIn(app);
      await app
        .get(PrismaService)
        .user.update({ where: { id: session.userId }, data: { status: 'BANNED' } });

      const me = await request(server)
        .get('/api/v1/users/me')
        .set(bearer(session.accessToken))
        .expect(403);
      expect(me.body.error.code).toBe('ACCOUNT_BANNED');

      await app.get<Redis>(REDIS).flushdb();
      await request(server)
        .post('/api/v1/auth/otp/request')
        .send({ phone: session.phone })
        .expect(202);
      const login = await request(server)
        .post('/api/v1/auth/otp/verify')
        .send({ phone: session.phone, code: smsOf(app).lastCode(session.phone) })
        .expect(403);
      expect(login.body.error.code).toBe('ACCOUNT_BANNED');
    });

    it('süresi dolmuş askı engel değildir', async () => {
      const session = await signIn(app);
      await app.get(PrismaService).user.update({
        where: { id: session.userId },
        data: { status: 'SUSPENDED', suspendedUntil: new Date(Date.now() - 1000) },
      });
      await request(server).get('/api/v1/users/me').set(bearer(session.accessToken)).expect(200);
    });
  });
});

async function decodeSid(token: string): Promise<{ sessionId: string }> {
  const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as {
    sid: string;
  };
  return { sessionId: payload.sid };
}
