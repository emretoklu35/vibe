import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Redis } from 'ioredis';
import request from 'supertest';

import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { REDIS } from '../../src/infra/redis/redis.module.js';
import { formatCalendarDate, todayInTurkey } from '../../src/modules/users/age.js';
import { bearer, grantConsent, signIn, type SignedIn } from './auth-helpers.js';

type Gender = 'WOMAN' | 'MAN' | 'NON_BINARY' | 'OTHER';

export const PLACES = {
  kadikoy: { latitude: 40.9903, longitude: 29.0294 },
  besiktas: { latitude: 41.0422, longitude: 29.0083 }, // Kadıköy'e ~6 km
  sariyer: { latitude: 41.1667, longitude: 29.05 }, // ~20 km
  izmit: { latitude: 40.7654, longitude: 29.9408 }, // ~80 km
} as const;

export type UserSpec = {
  gender: Gender;
  seeking?: Gender[];
  age?: number;
  minAge?: number;
  maxAge?: number;
  maxDistanceKm?: number;
  place?: { latitude: number; longitude: number };
  name?: string;
  interestSlugs?: string[];
  relationshipGoal?: string;
  discoverable?: boolean;
  photoStatus?: 'APPROVED' | 'NEEDS_REVIEW';
};

export type TestUser = SignedIn & { auth: ReturnType<typeof bearer> };

function birthDateForAge(age: number): string {
  const today = todayInTurkey();
  // Doğum gününü 10 gün önceye al: yaş kesin `age` olur.
  const d = new Date(Date.UTC(today.year - age, today.month - 1, today.day - 10));
  return formatCalendarDate({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
}

/**
 * Keşfete tamamen hazır bir kullanıcı: profil, onaylı fotoğraf, konum, rıza ve tercihler.
 * Fotoğraf satırı doğrudan DB'ye yazılır (görsel işleme ayrı testlerde sınanıyor).
 */
export async function makeUser(app: NestExpressApplication, spec: UserSpec): Promise<TestUser> {
  const server = app.getHttpServer();
  const prisma = app.get(PrismaService);
  const redis = app.get<Redis>(REDIS);
  // Çok sayıda test kullanıcısı aynı IP'den oluşturulur; OTP sınırları yalnızca burada sıfırlanır.
  const keys = await redis.keys('rl:*');
  if (keys.length > 0) await redis.del(...keys);

  const session = await signIn(app);
  const auth = bearer(session.accessToken);
  await request(server)
    .patch('/api/v1/users/me')
    .set(auth)
    .send({ birthDate: birthDateForAge(spec.age ?? 30) })
    .expect(200);

  const config = await request(server).get('/api/v1/app/config').expect(200);
  const required = (
    config.body.data.legalDocuments as { type: string; version: string; required: boolean }[]
  )
    .filter((d) => d.required)
    .map((d) => ({ type: d.type, granted: true, textVersion: d.version }));
  await request(server)
    .post('/api/v1/privacy/consents')
    .set(auth)
    .send({ decisions: required })
    .expect(200);

  await request(server)
    .put('/api/v1/profiles/me')
    .set(auth)
    .send({
      displayName: spec.name ?? 'Test',
      gender: spec.gender,
      relationshipGoal: spec.relationshipGoal ?? null,
      isDiscoverable: spec.discoverable ?? true,
    })
    .expect(200);

  if (spec.interestSlugs?.length) {
    const ids = (
      await prisma.interest.findMany({ where: { slug: { in: spec.interestSlugs } } })
    ).map((i) => i.id);
    await request(server)
      .put('/api/v1/profiles/me/interests')
      .set(auth)
      .send({ interestIds: ids })
      .expect(200);
  }

  const photoId = randomUUID();
  await prisma.profilePhoto.create({
    data: {
      id: photoId,
      userId: session.userId,
      position: 0,
      storageKey: `users/${session.userId}/photos/${photoId}.jpg`,
      status: spec.photoStatus ?? 'APPROVED',
      width: 800,
      height: 1000,
    },
  });

  const seeking = spec.seeking ?? [];
  if (seeking.length > 0)
    await grantConsent(app, session.accessToken, 'SPECIAL_CATEGORY_ORIENTATION');
  await request(server)
    .put('/api/v1/profiles/me/preferences')
    .set(auth)
    .send({
      minAge: spec.minAge ?? 18,
      maxAge: spec.maxAge ?? 99,
      maxDistanceKm: spec.maxDistanceKm ?? 50,
      seekingGenders: seeking,
      relationshipGoals: [],
    })
    .expect(200);

  await request(server)
    .put('/api/v1/profiles/me/location')
    .set(auth)
    .send(spec.place ?? PLACES.kadikoy)
    .expect(200);

  return { ...session, auth };
}

export async function candidateIds(app: NestExpressApplication, user: TestUser): Promise<string[]> {
  const res = await request(app.getHttpServer())
    .get('/api/v1/discovery/candidates?limit=20')
    .set(user.auth)
    .expect(200);
  return (res.body.data as { userId: string }[]).map((c) => c.userId);
}
