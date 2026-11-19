import type { NestExpressApplication } from '@nestjs/platform-express';
import { Redis } from 'ioredis';
import request from 'supertest';

import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { REDIS } from '../src/infra/redis/redis.module.js';
import { AccountDeletionService } from '../src/modules/users/account-deletion.service.js';
import { formatCalendarDate, todayInTurkey } from '../src/modules/users/age.js';
import { bearer, resetDatabase, signIn, signInOnboarded, smsOf } from './support/auth-helpers.js';
import { createTestApp } from './support/create-test-app.js';

type LegalDoc = { type: string; version: string; required: boolean };

/** Bugünden `years` yıl önce, `dayOffset` gün kaydırılmış doğum tarihi (Türkiye saatine göre). */
function birthDateYearsAgo(years: number, dayOffset = 0): string {
  const today = todayInTurkey();
  const d = new Date(Date.UTC(today.year - years, today.month - 1, today.day + dayOffset));
  return formatCalendarDate({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
}

describe('Hesap: doğum tarihi, rızalar, silme', () => {
  let app: NestExpressApplication;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let prisma: PrismaService;
  let legalDocs: LegalDoc[];

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDatabase(app);
    legalDocs = (await request(server).get('/api/v1/app/config').expect(200)).body.data
      .legalDocuments;
  });

  beforeEach(async () => {
    await app.get<Redis>(REDIS).flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  const required = () => legalDocs.filter((d) => d.required);

  describe('doğum tarihi ve 18 yaş kapısı', () => {
    it('var olmayan tarih → INVALID_BIRTH_DATE; yanlış biçim → VALIDATION_FAILED', async () => {
      const s = await signIn(app);
      const invalid = await request(server)
        .patch('/api/v1/users/me')
        .set(bearer(s.accessToken))
        .send({ birthDate: '2001-02-30' })
        .expect(400);
      expect(invalid.body.error.code).toBe('INVALID_BIRTH_DATE');
      const format = await request(server)
        .patch('/api/v1/users/me')
        .set(bearer(s.accessToken))
        .send({ birthDate: '23.04.1995' })
        .expect(400);
      expect(format.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('gelecek tarih reddedilir', async () => {
      const s = await signIn(app);
      const res = await request(server)
        .patch('/api/v1/users/me')
        .set(bearer(s.accessToken))
        .send({ birthDate: birthDateYearsAgo(0, 1) })
        .expect(400);
      expect(res.body.error.code).toBe('INVALID_BIRTH_DATE');
    });

    it('bugün 18 olan kabul edilir; yaş ve sonraki adım (CONSENTS) döner', async () => {
      const s = await signIn(app);
      const res = await request(server)
        .patch('/api/v1/users/me')
        .set(bearer(s.accessToken))
        .send({ birthDate: birthDateYearsAgo(18) })
        .expect(200);
      expect(res.body.data).toMatchObject({ age: 18, onboardingStep: 'CONSENTS' });
    });

    it('doğum tarihi ikinci kez değiştirilemez', async () => {
      const s = await signIn(app);
      const auth = bearer(s.accessToken);
      await request(server)
        .patch('/api/v1/users/me')
        .set(auth)
        .send({ birthDate: '1990-01-01' })
        .expect(200);
      const res = await request(server)
        .patch('/api/v1/users/me')
        .set(auth)
        .send({ birthDate: '1980-01-01' })
        .expect(409);
      expect(res.body.error.code).toBe('BIRTH_DATE_ALREADY_SET');
    });

    it('18’ine yarın girecek → UNDERAGE; hesap silinir, oturum düşer, numara 30 gün kayıt olamaz', async () => {
      const s = await signIn(app);
      const res = await request(server)
        .patch('/api/v1/users/me')
        .set(bearer(s.accessToken))
        .send({ birthDate: birthDateYearsAgo(18, 1) })
        .expect(403);
      expect(res.body.error.code).toBe('UNDERAGE');

      expect(await prisma.user.findUnique({ where: { id: s.userId } })).toBeNull();
      await request(server).get('/api/v1/users/me').set(bearer(s.accessToken)).expect(401);

      // Engel bilgisi Redis'te tutulduğu için flushdb yapılmaz; yalnızca OTP sınırları bu numara için temiz.
      await request(server).post('/api/v1/auth/otp/request').send({ phone: s.phone }).expect(429);
      const redis = app.get<Redis>(REDIS);
      for (const key of await redis.keys('rl:*')) await redis.del(key);
      await request(server).post('/api/v1/auth/otp/request').send({ phone: s.phone }).expect(202);
      const retry = await request(server)
        .post('/api/v1/auth/otp/verify')
        .send({ phone: s.phone, code: smsOf(app).lastCode(s.phone) })
        .expect(403);
      expect(retry.body.error.code).toBe('REGISTRATION_BLOCKED');
      expect(retry.body.error.details.retryAfterSeconds).toBeGreaterThan(29 * 24 * 3600);
    });
  });

  describe('rızalar', () => {
    it('/app/config zorunlu belgeleri ve sürümlerini listeler; metin okunabilir', async () => {
      expect(
        required()
          .map((d) => d.type)
          .sort(),
      ).toEqual(['PRIVACY_NOTICE_ACK', 'TERMS_OF_SERVICE']);
      const doc = await request(server).get('/api/v1/legal/documents/TERMS_OF_SERVICE').expect(200);
      expect(doc.body.data.body).toContain('TASLAK');
      await request(server).get('/api/v1/legal/documents/NOPE').expect(400);
    });

    it('zorunlu rızalar verilince onboarding tamamlanır', async () => {
      const s = await signIn(app);
      const auth = bearer(s.accessToken);
      await request(server)
        .patch('/api/v1/users/me')
        .set(auth)
        .send({ birthDate: '1995-04-23' })
        .expect(200);
      const res = await request(server)
        .post('/api/v1/privacy/consents')
        .set(auth)
        .send({
          decisions: required().map((d) => ({
            type: d.type,
            granted: true,
            textVersion: d.version,
          })),
        })
        .expect(200);
      expect(
        (res.body.data as { required: boolean; upToDate: boolean }[])
          .filter((c) => c.required)
          .every((c) => c.upToDate),
      ).toBe(true);
      const me = await request(server).get('/api/v1/users/me').set(auth).expect(200);
      expect(me.body.data.onboardingStep).toBe('COMPLETE');
    });

    it('eski metin sürümü → 409 CONSENT_VERSION_MISMATCH ve hiçbir karar yazılmaz', async () => {
      const s = await signIn(app);
      const [tos, privacy] = required();
      const res = await request(server)
        .post('/api/v1/privacy/consents')
        .set(bearer(s.accessToken))
        .send({
          decisions: [
            { type: tos!.type, granted: true, textVersion: tos!.version },
            { type: privacy!.type, granted: true, textVersion: 'eski-surum' },
          ],
        })
        .expect(409);
      expect(res.body.error.code).toBe('CONSENT_VERSION_MISMATCH');
      expect(await prisma.consentRecord.count({ where: { userId: s.userId } })).toBe(0);
    });

    it('zorunlu rıza geri alınamaz', async () => {
      const s = await signInOnboarded(app);
      const tos = required().find((d) => d.type === 'TERMS_OF_SERVICE')!;
      const res = await request(server)
        .post('/api/v1/privacy/consents')
        .set(bearer(s.accessToken))
        .send({ decisions: [{ type: tos.type, granted: false, textVersion: tos.version }] })
        .expect(409);
      expect(res.body.error.code).toBe('CONSENT_REQUIRED_CANNOT_WITHDRAW');
    });

    it('isteğe bağlı rıza verilip geri alınır; geçmiş silinmez (yalnızca ekleme)', async () => {
      const s = await signInOnboarded(app);
      const marketing = legalDocs.find((d) => d.type === 'MARKETING_NOTIFICATIONS')!;
      const auth = bearer(s.accessToken);
      for (const granted of [true, false]) {
        await request(server)
          .post('/api/v1/privacy/consents')
          .set(auth)
          .send({ decisions: [{ type: marketing.type, granted, textVersion: marketing.version }] })
          .expect(200);
      }
      const states = await request(server).get('/api/v1/privacy/consents').set(auth).expect(200);
      expect(
        states.body.data.find((c: { type: string }) => c.type === 'MARKETING_NOTIFICATIONS'),
      ).toMatchObject({
        granted: false,
        upToDate: false,
      });
      expect(
        await prisma.consentRecord.count({
          where: { userId: s.userId, type: 'MARKETING_NOTIFICATIONS' },
        }),
      ).toBe(2);
    });

    it('henüz kullanılmayan rıza türü → CONSENT_TYPE_UNAVAILABLE', async () => {
      const s = await signInOnboarded(app);
      const res = await request(server)
        .post('/api/v1/privacy/consents')
        .set(bearer(s.accessToken))
        .send({
          decisions: [{ type: 'SPECIAL_CATEGORY_ORIENTATION', granted: true, textVersion: 'x' }],
        })
        .expect(400);
      expect(res.body.error.code).toBe('CONSENT_TYPE_UNAVAILABLE');
    });
  });

  describe('hesap silme', () => {
    it('talep: 30 gün sonrası planlanır, tüm oturumlar kapanır', async () => {
      const s = await signInOnboarded(app);
      const res = await request(server)
        .delete('/api/v1/users/me')
        .set(bearer(s.accessToken))
        .expect(202);
      const days = (new Date(res.body.data.scheduledFor).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThanOrEqual(30);
      await request(server).get('/api/v1/users/me').set(bearer(s.accessToken)).expect(401);
    });

    it('bekleme sırasında giriş yapılabilir, yalnızca izinli uçlar açık, geri alınabilir', async () => {
      const s = await signInOnboarded(app);
      await request(server).delete('/api/v1/users/me').set(bearer(s.accessToken)).expect(202);
      await app.get<Redis>(REDIS).flushdb();
      const again = await signIn(app, s.phone);
      const auth = bearer(again.accessToken);

      const me = await request(server).get('/api/v1/users/me').set(auth).expect(200);
      expect(me.body.data.status).toBe('DELETION_PENDING');
      expect(me.body.data.deletion.scheduledFor).toBeTruthy();
      await request(server).get('/api/v1/privacy/consents').set(auth).expect(200);
      const blocked = await request(server).get('/api/v1/auth/sessions').set(auth).expect(403);
      expect(blocked.body.error.code).toBe('ACCOUNT_DELETION_PENDING');

      await request(server).post('/api/v1/users/me/restore').set(auth).expect(204);
      const restored = await request(server).get('/api/v1/users/me').set(auth).expect(200);
      expect(restored.body.data).toMatchObject({ status: 'ACTIVE', deletion: null });
      const twice = await request(server).post('/api/v1/users/me/restore').set(auth).expect(409);
      expect(twice.body.error.code).toBe('ACCOUNT_NOT_PENDING_DELETION');
    });

    it('süresi dolan talep worker tarafından kalıcı olarak yerine getirilir; geri alınan silinmez', async () => {
      const doomed = await signInOnboarded(app);
      const kept = await signInOnboarded(app);
      for (const s of [doomed, kept]) {
        await request(server).delete('/api/v1/users/me').set(bearer(s.accessToken)).expect(202);
      }
      await app.get<Redis>(REDIS).flushdb();
      const keptAgain = await signIn(app, kept.phone);
      await request(server)
        .post('/api/v1/users/me/restore')
        .set(bearer(keptAgain.accessToken))
        .expect(204);

      // Zamanı ileri sar: 30 gün dolmuş gibi.
      const future = new Date(Date.now() + 31 * 86_400_000);
      // Önceki testlerden kalan talepler de vadesi gelmiş sayılır; bu yüzden sayı değil sonuç doğrulanır.
      const result = await app.get(AccountDeletionService).purgeDue(future);
      expect(result.failed).toBe(0);
      expect(result.completed).toBeGreaterThanOrEqual(1);

      expect(await prisma.user.findUnique({ where: { id: doomed.userId } })).toBeNull();
      expect(await prisma.consentRecord.count({ where: { userId: doomed.userId } })).toBe(0);
      expect(await prisma.session.count({ where: { userId: doomed.userId } })).toBe(0);
      expect(await prisma.user.findUnique({ where: { id: kept.userId } })).not.toBeNull();

      const proof = await prisma.dataRequest.findMany({
        where: { userId: null, status: 'COMPLETED' },
      });
      expect(proof.length).toBeGreaterThanOrEqual(1);

      // Tekrar çalıştırmak bir şey yapmaz (idempotent).
      expect(await app.get(AccountDeletionService).purgeDue(future)).toEqual({
        completed: 0,
        failed: 0,
      });
    });

    it('süresi dolmamış talep silinmez', async () => {
      const s = await signInOnboarded(app);
      await request(server).delete('/api/v1/users/me').set(bearer(s.accessToken)).expect(202);
      await app.get(AccountDeletionService).purgeDue(new Date());
      expect(await prisma.user.findUnique({ where: { id: s.userId } })).not.toBeNull();
    });
  });
});
