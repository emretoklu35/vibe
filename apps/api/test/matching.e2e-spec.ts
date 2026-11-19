import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { resetDatabase } from './support/auth-helpers.js';
import { createTestApp } from './support/create-test-app.js';
import { candidateIds, makeUser, PLACES, type TestUser } from './support/discovery-helpers.js';

describe('Eşleşme: beğeni, eşleşme, eşleşmeyi bitirme, engelleme', () => {
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

  const pair = async (): Promise<[TestUser, TestUser]> => [
    await makeUser(app, { name: 'Ece', gender: 'WOMAN', seeking: ['MAN'] }),
    await makeUser(app, {
      name: 'Kaan',
      gender: 'MAN',
      seeking: ['WOMAN'],
      place: PLACES.besiktas,
    }),
  ];
  const like = (from: TestUser, to: TestUser) =>
    request(server).post('/api/v1/likes').set(from.auth).send({ targetUserId: to.userId });

  it('tek yönlü beğeni eşleşme değildir; karşılıklıda tek bir eşleşme oluşur', async () => {
    const [a, b] = await pair();
    const first = await like(a, b).expect(200);
    expect(first.body.data).toEqual({ matched: false, matchId: null });
    expect(await candidateIds(app, a)).toEqual([]);

    const second = await like(b, a).expect(200);
    expect(second.body.data.matched).toBe(true);
    expect(await prisma.match.count()).toBe(1);

    // Tekrar beğenmek idempotent: yeni kayıt yok, aynı eşleşme döner
    const again = await like(a, b).expect(200);
    expect(again.body.data).toEqual({ matched: true, matchId: second.body.data.matchId });
    expect(await prisma.like.count()).toBe(2);
    expect(await prisma.match.count()).toBe(1);

    const match = await prisma.match.findFirstOrThrow();
    expect(match.userAId < match.userBId).toBe(true);
  });

  it('eşzamanlı karşılıklı beğenide tam olarak bir eşleşme oluşur', async () => {
    for (let round = 0; round < 3; round++) {
      await resetDatabase(app);
      const [a, b] = await pair();
      const [x, y] = await Promise.all([like(a, b), like(b, a)]);
      expect([x.status, y.status]).toEqual([200, 200]);
      expect([x.body.data.matched, y.body.data.matched]).toContain(true);
      expect(await prisma.match.count()).toBe(1);
    }
  });

  it('keşfette görünmeyen, var olmayan veya kendisi → beğenilemez', async () => {
    const [a] = await pair();
    const invisible = await makeUser(app, {
      gender: 'MAN',
      seeking: ['MAN'],
      place: PLACES.besiktas,
    });
    await like(a, invisible).expect(404);
    await request(server)
      .post('/api/v1/likes')
      .set(a.auth)
      .send({ targetUserId: randomUUID() })
      .expect(404);
    const self = await request(server)
      .post('/api/v1/likes')
      .set(a.auth)
      .send({ targetUserId: a.userId })
      .expect(400);
    expect(self.body.error.code).toBe('CANNOT_TARGET_SELF');
    expect(await prisma.like.count()).toBe(0);
  });

  it('eşleşme listesi ve ayrıntısı; başkasının eşleşmesi → 404', async () => {
    const [a, b] = await pair();
    await like(a, b).expect(200);
    const { matchId } = (await like(b, a).expect(200)).body.data;

    const list = await request(server).get('/api/v1/matches').set(a.auth).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({
      matchId,
      user: { userId: b.userId, displayName: 'Kaan', age: 30 },
    });
    expect(list.body.meta.nextCursor).toBeNull();

    const detail = await request(server).get(`/api/v1/matches/${matchId}`).set(a.auth).expect(200);
    expect(detail.body.data.profile).toMatchObject({ userId: b.userId, displayName: 'Kaan' });

    const stranger = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
    await request(server).get(`/api/v1/matches/${matchId}`).set(stranger.auth).expect(404);
    await request(server).delete(`/api/v1/matches/${matchId}`).set(stranger.auth).expect(404);
  });

  it('eşleşmeyi bitirme: listeden çıkar, kişi tekrar önerilmez, yeniden beğeni eşleşme açmaz', async () => {
    const [a, b] = await pair();
    await like(a, b).expect(200);
    const { matchId } = (await like(b, a).expect(200)).body.data;
    await request(server).delete(`/api/v1/matches/${matchId}`).set(b.auth).expect(204);

    expect(
      (await request(server).get('/api/v1/matches').set(a.auth).expect(200)).body.data,
    ).toEqual([]);
    await request(server).get(`/api/v1/matches/${matchId}`).set(a.auth).expect(404);
    expect(await candidateIds(app, a)).toEqual([]);
    expect((await like(a, b).expect(200)).body.data).toEqual({ matched: false, matchId: null });
  });

  it('engelleme: eşleşme biter, beğeni yapılamaz; engel kalkınca eşleşme geri gelmez', async () => {
    const [a, b] = await pair();
    await like(a, b).expect(200);
    const { matchId } = (await like(b, a).expect(200)).body.data;

    await request(server)
      .post('/api/v1/safety/blocks')
      .set(a.auth)
      .send({ userId: b.userId })
      .expect(204);
    await request(server)
      .post('/api/v1/safety/blocks')
      .set(a.auth)
      .send({ userId: b.userId })
      .expect(204); // idempotent
    expect((await prisma.match.findUniqueOrThrow({ where: { id: matchId } })).status).toBe(
      'UNMATCHED',
    );
    expect(
      (await request(server).get('/api/v1/matches').set(b.auth).expect(200)).body.data,
    ).toEqual([]);
    await like(b, a).expect(404);

    const blocks = await request(server).get('/api/v1/safety/blocks').set(a.auth).expect(200);
    expect(blocks.body.data).toEqual([
      expect.objectContaining({ userId: b.userId, displayName: 'Kaan' }),
    ]);

    await request(server).delete(`/api/v1/safety/blocks/${b.userId}`).set(a.auth).expect(204);
    expect(
      (await request(server).get('/api/v1/matches').set(a.auth).expect(200)).body.data,
    ).toEqual([]);
  });

  it('karşı taraf hesabını silmek üzereyse eşleşme listede görünmez', async () => {
    const [a, b] = await pair();
    await like(a, b).expect(200);
    await like(b, a).expect(200);
    await request(server).delete('/api/v1/users/me').set(b.auth).expect(202);
    expect(
      (await request(server).get('/api/v1/matches').set(a.auth).expect(200)).body.data,
    ).toEqual([]);
  });

  it('eşleşme listesi sayfalanır', async () => {
    const viewer = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
    const others: TestUser[] = [];
    for (let i = 0; i < 22; i++) {
      others.push(
        await makeUser(app, { gender: 'MAN', seeking: ['WOMAN'], place: PLACES.besiktas }),
      );
    }
    for (const other of others) {
      await like(other, viewer).expect(200);
      await like(viewer, other).expect(200);
    }
    const first = await request(server).get('/api/v1/matches').set(viewer.auth).expect(200);
    expect(first.body.data).toHaveLength(20);
    const second = await request(server)
      .get(`/api/v1/matches?cursor=${first.body.meta.nextCursor}`)
      .set(viewer.auth)
      .expect(200);
    expect(second.body.data).toHaveLength(2);
    expect(second.body.meta.nextCursor).toBeNull();
    const all = [...first.body.data, ...second.body.data].map(
      (m: { matchId: string }) => m.matchId,
    );
    expect(new Set(all).size).toBe(22);

    await request(server).get('/api/v1/matches?cursor=bozuk').set(viewer.auth).expect(400);
  }, 60_000);
});
