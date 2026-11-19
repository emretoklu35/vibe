import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { resetDatabase, signInWithConsents } from './support/auth-helpers.js';
import { createTestApp } from './support/create-test-app.js';
import { candidateIds, makeUser, PLACES, type TestUser } from './support/discovery-helpers.js';

describe('Keşfet: hazırlık ve karşılıklı filtreler', () => {
  let app: NestExpressApplication;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('hazırlık', () => {
    it('eksikleri listeler; hazır değilken aday istemek 409 DISCOVERY_NOT_READY', async () => {
      const s = await signInWithConsents(app);
      const status = await request(server)
        .get('/api/v1/discovery/status')
        .set({ Authorization: `Bearer ${s.accessToken}` })
        .expect(200);
      expect(status.body.data.ready).toBe(false);
      expect(status.body.data.missing).toEqual(
        expect.arrayContaining(['PROFILE', 'APPROVED_PHOTO', 'LOCATION', 'ORIENTATION_CONSENT']),
      );
      const res = await request(server)
        .get('/api/v1/discovery/candidates')
        .set({ Authorization: `Bearer ${s.accessToken}` })
        .expect(409);
      expect(res.body.error.code).toBe('DISCOVERY_NOT_READY');
    });

    it('rıza vermeden geçen kullanıcı için keşfet kapalı (K7)', async () => {
      const u = await makeUser(app, { gender: 'WOMAN', seeking: [] });
      const status = await request(server).get('/api/v1/discovery/status').set(u.auth).expect(200);
      expect(status.body.data).toEqual({ ready: false, missing: ['ORIENTATION_CONSENT'] });
    });

    it('her şey tamamsa hazır', async () => {
      const u = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      const status = await request(server).get('/api/v1/discovery/status').set(u.auth).expect(200);
      expect(status.body.data).toEqual({ ready: true, missing: [] });
    });
  });

  it('sert filtreler karşılıklı uygulanır; yalnızca uygun aday döner', async () => {
    const viewer = await makeUser(app, {
      gender: 'WOMAN',
      seeking: ['MAN'],
      age: 30,
      minAge: 25,
      maxAge: 40,
      maxDistanceKm: 30,
      place: PLACES.kadikoy,
    });
    const ok = await makeUser(app, {
      name: 'Uygun',
      gender: 'MAN',
      seeking: ['WOMAN'],
      age: 32,
      place: PLACES.besiktas,
    });
    const rejects: Record<string, TestUser> = {
      menOnly: await makeUser(app, {
        gender: 'MAN',
        seeking: ['MAN'],
        age: 32,
        place: PLACES.besiktas,
      }),
      woman: await makeUser(app, {
        gender: 'WOMAN',
        seeking: ['WOMAN'],
        age: 32,
        place: PLACES.besiktas,
      }),
      tooOld: await makeUser(app, {
        gender: 'MAN',
        seeking: ['WOMAN'],
        age: 45,
        place: PLACES.besiktas,
      }),
      viewerTooOldForHim: await makeUser(app, {
        gender: 'MAN',
        seeking: ['WOMAN'],
        age: 26,
        minAge: 18,
        maxAge: 24,
        place: PLACES.besiktas,
      }),
      tooFar: await makeUser(app, {
        gender: 'MAN',
        seeking: ['WOMAN'],
        age: 32,
        place: PLACES.izmit,
      }),
      hisDistanceTooSmall: await makeUser(app, {
        gender: 'MAN',
        seeking: ['WOMAN'],
        age: 32,
        maxDistanceKm: 2,
        place: PLACES.sariyer,
      }),
      hidden: await makeUser(app, {
        gender: 'MAN',
        seeking: ['WOMAN'],
        age: 32,
        discoverable: false,
        place: PLACES.besiktas,
      }),
      noApprovedPhoto: await makeUser(app, {
        gender: 'MAN',
        seeking: ['WOMAN'],
        age: 32,
        photoStatus: 'NEEDS_REVIEW',
        place: PLACES.besiktas,
      }),
      pendingDeletion: await makeUser(app, {
        gender: 'MAN',
        seeking: ['WOMAN'],
        age: 32,
        place: PLACES.besiktas,
      }),
      noConsent: await makeUser(app, {
        gender: 'MAN',
        seeking: [],
        age: 32,
        place: PLACES.besiktas,
      }),
    };
    await prisma.user.update({
      where: { id: rejects.pendingDeletion!.userId },
      data: { status: 'DELETION_PENDING' },
    });

    expect(await candidateIds(app, viewer)).toEqual([ok.userId]);
  });

  it('kart: onaylı fotoğraflar, yuvarlanmış mesafe, açıklanabilir uyum; özel veri ve koordinat yok', async () => {
    const viewer = await makeUser(app, {
      gender: 'WOMAN',
      seeking: ['MAN'],
      interestSlugs: ['coffee', 'jazz', 'hiking'],
      relationshipGoal: 'LONG_TERM',
    });
    await makeUser(app, {
      name: 'Kaan',
      gender: 'MAN',
      seeking: ['WOMAN'],
      interestSlugs: ['coffee', 'jazz', 'football'],
      relationshipGoal: 'LONG_TERM',
      place: PLACES.besiktas,
    });
    const res = await request(server)
      .get('/api/v1/discovery/candidates')
      .set(viewer.auth)
      .expect(200);
    const [card] = res.body.data;
    expect(card).toMatchObject({ displayName: 'Kaan', gender: 'MAN', age: 30 });
    expect(card.distanceLabel).toMatch(/^\d+ km$|km'den yakın/);
    expect(card.photos).toHaveLength(1);
    expect(card.photos[0].url).toMatch(/^http/);
    expect(card.compatibility.score).toBeGreaterThan(0);
    expect(card.compatibility.reasons).toEqual(
      expect.arrayContaining([
        '2 ortak ilgi alanı: Caz, Kahve',
        'İkiniz de aynı ilişki beklentisindesiniz',
      ]),
    );
    const raw = JSON.stringify(card);
    expect(raw).not.toMatch(/seekingGenders|latitude|longitude|"location"|minAge|maxAge/);
  });

  it('engellenen kişi iki yönde de görünmez', async () => {
    const a = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
    const b = await makeUser(app, { gender: 'MAN', seeking: ['WOMAN'], place: PLACES.besiktas });
    expect(await candidateIds(app, a)).toEqual([b.userId]);
    await request(server)
      .post('/api/v1/safety/blocks')
      .set(b.auth)
      .send({ userId: a.userId })
      .expect(204);
    expect(await candidateIds(app, a)).toEqual([]);
    expect(await candidateIds(app, b)).toEqual([]);
  });

  it('geçilen kişi 30 gün gösterilmez, süre dolunca tekrar gelir', async () => {
    const a = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
    const b = await makeUser(app, { gender: 'MAN', seeking: ['WOMAN'], place: PLACES.besiktas });
    await request(server)
      .post('/api/v1/passes')
      .set(a.auth)
      .send({ targetUserId: b.userId })
      .expect(204);
    expect(await candidateIds(app, a)).toEqual([]);
    const pass = await prisma.pass.findFirstOrThrow({ where: { actorId: a.userId } });
    expect((pass.expiresAt.getTime() - Date.now()) / 86_400_000).toBeGreaterThan(29.9);
    await prisma.pass.update({
      where: { id: pass.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await candidateIds(app, a)).toEqual([b.userId]);
  });

  it('uyum puanı yüksek olan önce gelir', async () => {
    const viewer = await makeUser(app, {
      gender: 'WOMAN',
      seeking: ['MAN'],
      interestSlugs: ['coffee', 'jazz', 'hiking'],
      relationshipGoal: 'LONG_TERM',
    });
    const low = await makeUser(app, {
      gender: 'MAN',
      seeking: ['WOMAN'],
      interestSlugs: ['football'],
      relationshipGoal: 'SHORT_TERM',
      place: PLACES.besiktas,
    });
    const high = await makeUser(app, {
      gender: 'MAN',
      seeking: ['WOMAN'],
      interestSlugs: ['coffee', 'jazz', 'hiking'],
      relationshipGoal: 'LONG_TERM',
      place: PLACES.besiktas,
    });
    expect(await candidateIds(app, viewer)).toEqual([high.userId, low.userId]);
  });
});
