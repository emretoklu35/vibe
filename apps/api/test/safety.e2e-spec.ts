import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { StorageService } from '../src/infra/storage/storage.service.js';
import { AccountDeletionService } from '../src/modules/users/account-deletion.service.js';
import { resetDatabase } from './support/auth-helpers.js';
import { createTestApp } from './support/create-test-app.js';
import { candidateIds, makeUser, PLACES, type TestUser } from './support/discovery-helpers.js';
import { testJpeg } from './support/media-helpers.js';

describe('Güvenlik: şikayet, iletişim bilgisi, selfie doğrulama', () => {
  let app: NestExpressApplication;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let prisma: PrismaService;
  let storage: StorageService;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    await storage.removePrefix('evidence/');
  });

  afterAll(async () => {
    await app.close();
  });

  const report = (from: TestUser, body: Record<string, unknown>) =>
    request(server).post('/api/v1/safety/reports').set(from.auth).send(body);

  async function matched(): Promise<{ a: TestUser; b: TestUser; conversationId: string }> {
    const a = await makeUser(app, { name: 'Ece', gender: 'WOMAN', seeking: ['MAN'] });
    const b = await makeUser(app, {
      name: 'Kaan',
      gender: 'MAN',
      seeking: ['WOMAN'],
      place: PLACES.besiktas,
    });
    await request(server)
      .post('/api/v1/likes')
      .set(a.auth)
      .send({ targetUserId: b.userId })
      .expect(200);
    const res = await request(server)
      .post('/api/v1/likes')
      .set(b.auth)
      .send({ targetUserId: a.userId })
      .expect(200);
    return { a, b, conversationId: res.body.data.conversationId };
  }

  async function withRealPhoto(user: TestUser): Promise<string> {
    const photo = await prisma.profilePhoto.findFirstOrThrow({ where: { userId: user.userId } });
    await storage.write(photo.storageKey, await testJpeg(), 'image/jpeg');
    return photo.id;
  }

  describe('şikayet', () => {
    it('profil şikayeti: kanıt (profil + fotoğraf kopyası) saklanır, öncelik atanır', async () => {
      const { a, b } = await matched();
      await withRealPhoto(b);
      const res = await report(a, {
        userId: b.userId,
        reason: 'FAKE_PROFILE',
        targetType: 'PROFILE',
        comment: 'Fotoğraflar başkasına ait',
      }).expect(201);
      const row = await prisma.report.findUniqueOrThrow({ where: { id: res.body.data.id } });
      expect(row).toMatchObject({
        status: 'OPEN',
        priority: 40,
        reporterId: a.userId,
        reportedUserId: b.userId,
      });
      const evidence = row.evidence as { profile: { displayName: string }; photoKeys: string[] };
      expect(evidence.profile.displayName).toBe('Kaan');
      expect(evidence.photoKeys).toHaveLength(1);
      expect(await storage.size(evidence.photoKeys[0]!)).toBeGreaterThan(0);
    });

    it('mesaj şikayeti: mesaj ve bağlamı saklanır; başkasının mesajı şikayet edilemez', async () => {
      const { a, b, conversationId } = await matched();
      const send = (u: TestUser, body: string) =>
        request(server)
          .post(`/api/v1/conversations/${conversationId}/messages`)
          .set(u.auth)
          .send({ id: randomUUID(), body });
      await send(a, 'Merhaba');
      const bad = (await send(b, 'Hakaret içeren mesaj').expect(201)).body.data;
      const mine = (await send(a, 'Lütfen böyle konuşma').expect(201)).body.data;

      await report(a, {
        userId: b.userId,
        reason: 'HARASSMENT',
        targetType: 'MESSAGE',
        targetId: mine.id,
      }).expect(404);
      const res = await report(a, {
        userId: b.userId,
        reason: 'HARASSMENT',
        targetType: 'MESSAGE',
        targetId: bad.id,
      }).expect(201);
      const evidence = (await prisma.report.findUniqueOrThrow({ where: { id: res.body.data.id } }))
        .evidence as {
        message: { body: string };
        context: { from: string; body: string }[];
      };
      expect(evidence.message.body).toBe('Hakaret içeren mesaj');
      expect(evidence.context.map((m) => m.from)).toEqual(['reporter', 'reported']);

      // Mesaj sonradan silinse de kanıt kalır
      await request(server)
        .delete(`/api/v1/conversations/${conversationId}/messages/${bad.id}`)
        .set(b.auth)
        .expect(204);
      const after = (await prisma.report.findUniqueOrThrow({ where: { id: res.body.data.id } }))
        .evidence as { message: { body: string } };
      expect(after.message.body).toBe('Hakaret içeren mesaj');
    });

    it('geçersiz hedefler reddedilir; tekrar şikayet yeni kayıt açmaz', async () => {
      const { a, b } = await matched();
      expect(
        (await report(a, { userId: a.userId, reason: 'OTHER', targetType: 'PROFILE' }).expect(400))
          .body.error.code,
      ).toBe('CANNOT_TARGET_SELF');
      await report(a, { userId: randomUUID(), reason: 'OTHER', targetType: 'PROFILE' }).expect(404);
      await report(a, {
        userId: b.userId,
        reason: 'NUDITY_SEXUAL',
        targetType: 'PHOTO',
        targetId: randomUUID(),
      }).expect(404);
      await report(a, { userId: b.userId, reason: 'NUDITY_SEXUAL', targetType: 'PHOTO' }).expect(
        400,
      );
      const first = await report(a, {
        userId: b.userId,
        reason: 'SCAM_SPAM',
        targetType: 'PROFILE',
      }).expect(201);
      const second = await report(a, {
        userId: b.userId,
        reason: 'SCAM_SPAM',
        targetType: 'PROFILE',
      }).expect(201);
      expect(second.body.data.id).toBe(first.body.data.id);
      expect(await prisma.report.count()).toBe(1);
    });

    it('reşit olmayan şikayeti hesabı hemen keşfetten gizler', async () => {
      const viewer = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      const reporter = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      const suspect = await makeUser(app, {
        gender: 'MAN',
        seeking: ['WOMAN'],
        place: PLACES.besiktas,
      });
      expect(await candidateIds(app, viewer)).toEqual([suspect.userId]);
      await report(reporter, {
        userId: suspect.userId,
        reason: 'UNDERAGE',
        targetType: 'PROFILE',
      }).expect(201);
      expect(await candidateIds(app, viewer)).toEqual([]);
      const status = await request(server)
        .get('/api/v1/discovery/status')
        .set(suspect.auth)
        .expect(200);
      expect(status.body.data.missing).toContain('UNDER_REVIEW');
    });

    it('farklı 3 kişiden açık şikayet hesabı gizler; aynı kişinin tekrarları sayılmaz', async () => {
      const suspect = await makeUser(app, {
        gender: 'MAN',
        seeking: ['WOMAN'],
        place: PLACES.besiktas,
      });
      const reporters = [
        await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] }),
        await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] }),
        await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] }),
      ];
      await report(reporters[0]!, {
        userId: suspect.userId,
        reason: 'SCAM_SPAM',
        targetType: 'PROFILE',
      }).expect(201);
      await report(reporters[0]!, {
        userId: suspect.userId,
        reason: 'HARASSMENT',
        targetType: 'PROFILE',
      }).expect(201);
      await report(reporters[1]!, {
        userId: suspect.userId,
        reason: 'SCAM_SPAM',
        targetType: 'PROFILE',
      }).expect(201);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: suspect.userId } })).moderationHold,
      ).toBe(false);
      await report(reporters[2]!, {
        userId: suspect.userId,
        reason: 'SCAM_SPAM',
        targetType: 'PROFILE',
      }).expect(201);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: suspect.userId } })).moderationHold,
      ).toBe(true);
    });

    it('şikayet + engelle; şikayet edilen hesabını silse de kanıt kalır', async () => {
      const { a, b } = await matched();
      await withRealPhoto(b);
      const res = await report(a, {
        userId: b.userId,
        reason: 'VIOLENCE_THREAT',
        targetType: 'PROFILE',
        alsoBlock: true,
      }).expect(201);
      expect(
        await prisma.block.count({ where: { blockerId: a.userId, blockedId: b.userId } }),
      ).toBe(1);

      await request(server).delete('/api/v1/users/me').set(b.auth).expect(202);
      await app.get(AccountDeletionService).purgeDue(new Date(Date.now() + 31 * 86_400_000));
      const row = await prisma.report.findUniqueOrThrow({ where: { id: res.body.data.id } });
      expect(row.reportedUserId).toBeNull();
      const keys = (row.evidence as { photoKeys: string[] }).photoKeys;
      expect(await storage.size(keys[0]!)).toBeGreaterThan(0);
    });
  });

  describe('iletişim bilgisi', () => {
    it('telefon içeren mesaj işaretlenir (engellenmez), normal mesaj işaretlenmez', async () => {
      const { a, conversationId } = await matched();
      const flagged = await request(server)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set(a.auth)
        .send({ id: randomUUID(), body: 'buradan değil whatsapp yaz: 0532 123 45 67' })
        .expect(201);
      expect(flagged.body.data.flagged).toBe(true);
      const normal = await request(server)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set(a.auth)
        .send({ id: randomUUID(), body: 'Cumartesi 19:30 uygun mu?' })
        .expect(201);
      expect(normal.body.data.flagged).toBe(false);
    });

    it('profil metninde iletişim bilgisi reddedilir', async () => {
      const u = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      const res = await request(server)
        .put('/api/v1/profiles/me')
        .set(u.auth)
        .send({ displayName: 'Ece', gender: 'WOMAN', bio: 'insta: ece.dnz' })
        .expect(400);
      expect(res.body.error).toMatchObject({
        code: 'CONTACT_INFO_NOT_ALLOWED',
        details: [{ field: 'bio' }],
      });
    });
  });

  describe('selfie doğrulama (kullanıcı tarafı)', () => {
    async function submitSelfie(u: TestUser) {
      const file = await testJpeg(600, 800, { Copyright: 'selfie-exif' });
      const created = await request(server)
        .post('/api/v1/safety/verification/upload-url')
        .set(u.auth)
        .send({ contentType: 'image/jpeg', sizeBytes: file.length })
        .expect(201);
      await fetch(created.body.data.uploadUrl, {
        method: 'PUT',
        body: new Uint8Array(file),
        headers: created.body.data.uploadHeaders,
      });
      return request(server)
        .post(`/api/v1/safety/verification/${created.body.data.verificationId}/submit`)
        .set(u.auth);
    }

    it('yükle → incelemede; inceleme sürerken yenisi istenemez; selfie EXIF’siz saklanır', async () => {
      const u = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      expect(
        (await request(server).get('/api/v1/safety/verification').set(u.auth)).body.data,
      ).toMatchObject({
        status: 'NONE',
        verified: false,
        required: false,
      });
      const submitted = await submitSelfie(u);
      expect(submitted.status).toBe(200);
      expect(submitted.body.data.status).toBe('PENDING');
      const row = await prisma.verification.findFirstOrThrow({ where: { userId: u.userId } });
      const stored = await storage.read(row.selfieKey!);
      expect(stored.includes(Buffer.from('selfie-exif'))).toBe(false);

      const again = await request(server)
        .post('/api/v1/safety/verification/upload-url')
        .set(u.auth)
        .send({ contentType: 'image/jpeg', sizeBytes: 1000 })
        .expect(409);
      expect(again.body.error.code).toBe('VERIFICATION_ALREADY_PENDING');
    });
  });
});
