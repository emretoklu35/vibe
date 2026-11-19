import type { NestExpressApplication } from '@nestjs/platform-express';
import { Redis } from 'ioredis';
import request from 'supertest';

import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { REDIS } from '../src/infra/redis/redis.module.js';
import { distanceMeters } from '../src/modules/profiles/location-fuzz.js';
import { bearer, grantConsent, resetDatabase, signInWithConsents } from './support/auth-helpers.js';
import { createTestApp } from './support/create-test-app.js';
import { testJpeg, uploadPhoto, validProfile } from './support/media-helpers.js';

describe('Profil, ilgi alanları, tercihler, konum', () => {
  let app: NestExpressApplication;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDatabase(app);
  });

  beforeEach(async () => {
    await app.get<Redis>(REDIS).flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  const step = async (token: string) =>
    (await request(server).get('/api/v1/users/me').set(bearer(token)).expect(200)).body.data
      .onboardingStep;

  describe('profil', () => {
    it('oluşturur, günceller; boş metin null olur', async () => {
      const s = await signInWithConsents(app);
      const created = await request(server)
        .put('/api/v1/profiles/me')
        .set(bearer(s.accessToken))
        .send({ ...validProfile, heightCm: 172, cityName: '  Kadıköy, İstanbul  ' })
        .expect(200);
      expect(created.body.data.profile).toMatchObject({
        displayName: 'Deniz',
        gender: 'WOMAN',
        heightCm: 172,
        cityName: 'Kadıköy, İstanbul',
        isDiscoverable: true,
        locationUpdatedAt: null,
      });

      const updated = await request(server)
        .put('/api/v1/profiles/me')
        .set(bearer(s.accessToken))
        .send({ ...validProfile, displayName: 'Deniz Ece', bio: '   ' })
        .expect(200);
      expect(updated.body.data.profile).toMatchObject({ displayName: 'Deniz Ece', bio: null });
    });

    it.each([
      ['rakamlı ad', { displayName: 'Deniz123' }],
      ['bağlantılı ad', { displayName: 'insta.com/deniz' }],
      ['boş ad', { displayName: '   ' }],
      ['geçersiz cinsiyet', { gender: 'ROBOT' }],
      ['boy aralık dışı', { heightCm: 300 }],
      ['bilinmeyen alan', { phone: '+905321234567' }],
    ])('%s → VALIDATION_FAILED', async (_label, patch) => {
      const s = await signInWithConsents(app);
      const res = await request(server)
        .put('/api/v1/profiles/me')
        .set(bearer(s.accessToken))
        .send({ ...validProfile, ...patch })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('onboarding sırası', () => {
    it('PROFILE → PHOTOS → PREFERENCES → COMPLETE', async () => {
      const s = await signInWithConsents(app);
      const auth = bearer(s.accessToken);
      expect(await step(s.accessToken)).toBe('PROFILE');

      await request(server).put('/api/v1/profiles/me').set(auth).send(validProfile).expect(200);
      expect(await step(s.accessToken)).toBe('PHOTOS');

      const photo = await uploadPhoto(app, s.accessToken, await testJpeg());
      // İşlenmeyi beklerken de fotoğraf adımı geçilmiş sayılır.
      expect(photo.status).toBe('PROCESSING');
      expect(await step(s.accessToken)).toBe('PREFERENCES');

      // Rıza vermeden "aranan cinsiyet" boş bırakılarak da adım geçilebilir (keşfet kapalı kalır, K7).
      await request(server)
        .put('/api/v1/profiles/me/preferences')
        .set(auth)
        .send({
          minAge: 25,
          maxAge: 40,
          maxDistanceKm: 30,
          seekingGenders: [],
          relationshipGoals: [],
        })
        .expect(200);
      expect(await step(s.accessToken)).toBe('COMPLETE');
    });

    it('reddedilen fotoğraf adımı geçirmez', async () => {
      const s = await signInWithConsents(app);
      await request(server)
        .put('/api/v1/profiles/me')
        .set(bearer(s.accessToken))
        .send(validProfile)
        .expect(200);
      const photo = await uploadPhoto(app, s.accessToken, await testJpeg());
      await prisma.profilePhoto.update({ where: { id: photo.id }, data: { status: 'REJECTED' } });
      expect(await step(s.accessToken)).toBe('PHOTOS');
    });
  });

  describe('ilgi alanları', () => {
    it('katalog herkese açık; seçim kaydedilir ve değiştirilir', async () => {
      const catalog = await request(server).get('/api/v1/interests').expect(200);
      expect(catalog.body.data.length).toBeGreaterThan(10);
      const ids = (catalog.body.data as { id: number }[]).slice(0, 3).map((i) => i.id);

      const s = await signInWithConsents(app);
      const res = await request(server)
        .put('/api/v1/profiles/me/interests')
        .set(bearer(s.accessToken))
        .send({ interestIds: ids })
        .expect(200);
      const byNumber = (a: number, b: number) => a - b;
      expect((res.body.data.interests as { id: number }[]).map((i) => i.id).sort(byNumber)).toEqual(
        [...ids].sort(byNumber),
      );

      const cleared = await request(server)
        .put('/api/v1/profiles/me/interests')
        .set(bearer(s.accessToken))
        .send({ interestIds: [] })
        .expect(200);
      expect(cleared.body.data.interests).toEqual([]);
    });

    it('bilinmeyen id → INVALID_INTEREST; tekrar eden veya 10’dan fazla → VALIDATION_FAILED', async () => {
      const s = await signInWithConsents(app);
      const auth = bearer(s.accessToken);
      const unknown = await request(server)
        .put('/api/v1/profiles/me/interests')
        .set(auth)
        .send({ interestIds: [999999] })
        .expect(400);
      expect(unknown.body.error).toMatchObject({
        code: 'INVALID_INTEREST',
        details: { unknownIds: [999999] },
      });
      await request(server)
        .put('/api/v1/profiles/me/interests')
        .set(auth)
        .send({ interestIds: [1, 1] })
        .expect(400);
      await request(server)
        .put('/api/v1/profiles/me/interests')
        .set(auth)
        .send({ interestIds: Array.from({ length: 11 }, (_, i) => i + 1) })
        .expect(400);
    });
  });

  describe('tercihler ve özel nitelikli veri rızası (K7)', () => {
    const prefs = {
      minAge: 25,
      maxAge: 35,
      maxDistanceKm: 40,
      seekingGenders: ['MAN'],
      relationshipGoals: ['LONG_TERM'],
    };

    it('rıza yokken aranan cinsiyet kaydedilemez → 403 CONSENT_REQUIRED', async () => {
      const s = await signInWithConsents(app);
      const res = await request(server)
        .put('/api/v1/profiles/me/preferences')
        .set(bearer(s.accessToken))
        .send(prefs)
        .expect(403);
      expect(res.body.error).toMatchObject({
        code: 'CONSENT_REQUIRED',
        details: { type: 'SPECIAL_CATEGORY_ORIENTATION' },
      });
      expect(await prisma.preference.count({ where: { userId: s.userId } })).toBe(0);
    });

    it('rıza verilince kaydedilir; rıza geri alınınca aranan cinsiyet aynı anda silinir', async () => {
      const s = await signInWithConsents(app);
      const auth = bearer(s.accessToken);
      await grantConsent(app, s.accessToken, 'SPECIAL_CATEGORY_ORIENTATION');
      const saved = await request(server)
        .put('/api/v1/profiles/me/preferences')
        .set(auth)
        .send(prefs)
        .expect(200);
      expect(saved.body.data).toEqual(prefs);

      await grantConsent(app, s.accessToken, 'SPECIAL_CATEGORY_ORIENTATION', false);
      const after = await request(server)
        .get('/api/v1/profiles/me/preferences')
        .set(auth)
        .expect(200);
      expect(after.body.data).toMatchObject({ seekingGenders: [], minAge: 25, maxAge: 35 });
    });

    it('minAge > maxAge ve 18 altı yaş aralığı reddedilir', async () => {
      const s = await signInWithConsents(app);
      const auth = bearer(s.accessToken);
      await request(server)
        .put('/api/v1/profiles/me/preferences')
        .set(auth)
        .send({ ...prefs, seekingGenders: [], minAge: 40, maxAge: 30 })
        .expect(400);
      await request(server)
        .put('/api/v1/profiles/me/preferences')
        .set(auth)
        .send({ ...prefs, seekingGenders: [], minAge: 16 })
        .expect(400);
    });
  });

  describe('konum', () => {
    const real = { latitude: 41.0369, longitude: 28.985 };

    it('profil yoksa PROFILE_REQUIRED', async () => {
      const s = await signInWithConsents(app);
      const res = await request(server)
        .put('/api/v1/profiles/me/location')
        .set(bearer(s.accessToken))
        .send(real)
        .expect(409);
      expect(res.body.error.code).toBe('PROFILE_REQUIRED');
    });

    it('yanıtta koordinat yok; DB’de gerçek konum değil bulanık nokta var', async () => {
      const s = await signInWithConsents(app);
      const auth = bearer(s.accessToken);
      await request(server).put('/api/v1/profiles/me').set(auth).send(validProfile).expect(200);
      const res = await request(server)
        .put('/api/v1/profiles/me/location')
        .set(auth)
        .send(real)
        .expect(200);
      expect(Object.keys(res.body.data)).toEqual(['locationUpdatedAt']);
      expect(JSON.stringify(res.body)).not.toContain('41.03');

      const [stored] = await prisma.$queryRaw<{ lat: number; lng: number }[]>`
        SELECT ST_Y("location"::geometry) AS lat, ST_X("location"::geometry) AS lng
        FROM "Profile" WHERE "userId" = ${s.userId}::uuid`;
      const d = distanceMeters(real, { latitude: stored!.lat, longitude: stored!.lng });
      expect(d).toBeGreaterThan(50);
      expect(d).toBeLessThan(1_400);

      const me = await request(server).get('/api/v1/profiles/me').set(auth).expect(200);
      expect(me.body.data.profile.locationUpdatedAt).toBeTruthy();
      expect(JSON.stringify(me.body)).not.toMatch(/latitude|longitude|location"/);
    });

    it('saatte 6’dan fazla güncelleme → 429', async () => {
      const s = await signInWithConsents(app);
      const auth = bearer(s.accessToken);
      await request(server).put('/api/v1/profiles/me').set(auth).send(validProfile).expect(200);
      for (let i = 0; i < 6; i++) {
        await request(server).put('/api/v1/profiles/me/location').set(auth).send(real).expect(200);
      }
      await request(server).put('/api/v1/profiles/me/location').set(auth).send(real).expect(429);
    });

    it('geçersiz koordinat → VALIDATION_FAILED', async () => {
      const s = await signInWithConsents(app);
      await request(server)
        .put('/api/v1/profiles/me/location')
        .set(bearer(s.accessToken))
        .send({ latitude: 95, longitude: 10 })
        .expect(400);
    });
  });
});
