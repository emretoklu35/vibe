import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Redis } from 'ioredis';
import request from 'supertest';

import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { REDIS } from '../src/infra/redis/redis.module.js';
import { StorageService } from '../src/infra/storage/storage.service.js';
import { totp } from '../src/modules/admin/auth/totp.js';
import { DataExportService } from '../src/modules/privacy/data-export.service.js';
import { RetentionService } from '../src/modules/privacy/retention.service.js';
import { adminAuth, createAdmin } from './support/admin-helpers.js';
import { bearer, resetDatabase, signIn } from './support/auth-helpers.js';
import { createTestApp } from './support/create-test-app.js';
import { candidateIds, makeUser, PLACES, type TestUser } from './support/discovery-helpers.js';
import { testJpeg } from './support/media-helpers.js';

describe('Yönetim: giriş, roller, moderasyon, denetim, erişim kaydı, dışa aktarma', () => {
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
    await app.get<Redis>(REDIS).flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  const userReport = (from: TestUser, to: TestUser, reason = 'HARASSMENT') =>
    request(server)
      .post('/api/v1/safety/reports')
      .set(from.auth)
      .send({ userId: to.userId, reason, targetType: 'PROFILE' })
      .expect(201);

  describe('giriş', () => {
    it('e-posta + parola + TOTP ile giriş; yanlış faktör hangisi olursa olsun aynı hata', async () => {
      const admin = await createAdmin(app, 'MODERATOR');
      const me = await request(server)
        .get('/api/v1/admin/auth/me')
        .set(adminAuth(admin))
        .expect(200);
      expect(me.body.data).toMatchObject({ email: admin.email, role: 'MODERATOR' });

      const wrongPassword = await request(server)
        .post('/api/v1/admin/auth/login')
        .send({ email: admin.email, password: 'yanlış', totp: totp(admin.secret) })
        .expect(401);
      const wrongTotp = await request(server)
        .post('/api/v1/admin/auth/login')
        .send({ email: admin.email, password: admin.password, totp: '000000' })
        .expect(401);
      const unknown = await request(server)
        .post('/api/v1/admin/auth/login')
        .send({ email: 'yok@vibe.test', password: 'x', totp: '123456' })
        .expect(401);
      for (const res of [wrongPassword, wrongTotp, unknown]) {
        expect(res.body.error).toEqual({
          code: 'ADMIN_LOGIN_FAILED',
          message: 'E-posta, parola veya doğrulama kodu hatalı',
        });
      }
    });

    it('5 hatalı denemede hesap kilitlenir', async () => {
      const admin = await createAdmin(app, 'MODERATOR');
      for (let i = 0; i < 5; i++) {
        await request(server)
          .post('/api/v1/admin/auth/login')
          .send({ email: admin.email, password: 'yanlış', totp: '000000' })
          .expect(401);
        await app.get<Redis>(REDIS).flushdb(); // IP/e-posta hız sınırı kilitlemeden önce devreye girmesin
      }
      const locked = await request(server)
        .post('/api/v1/admin/auth/login')
        .send({ email: admin.email, password: admin.password, totp: totp(admin.secret) })
        .expect(403);
      expect(locked.body.error.code).toBe('ADMIN_LOCKED');
    });

    it('kullanıcı token’ı yönetim uçlarında, yönetici token’ı kullanıcı uçlarında geçmez; çıkış oturumu kapatır', async () => {
      const admin = await createAdmin(app, 'ADMIN');
      const user = await signIn(app);
      await request(server)
        .get('/api/v1/admin/reports')
        .set({ Authorization: `Bearer ${user.accessToken}` })
        .expect(401);
      await request(server).get('/api/v1/users/me').set(adminAuth(admin)).expect(401);
      await request(server).post('/api/v1/admin/auth/logout').set(adminAuth(admin)).expect(204);
      await request(server).get('/api/v1/admin/auth/me').set(adminAuth(admin)).expect(401);
    });
  });

  describe('roller', () => {
    it('SUPPORT okur ama değiştiremez; MODERATOR ban atamaz; ADMIN atar ve oturumlar kapanır', async () => {
      const a = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      const b = await makeUser(app, { gender: 'MAN', seeking: ['WOMAN'], place: PLACES.besiktas });
      const reportId = (await userReport(a, b)).body.data.id;

      const support = await createAdmin(app, 'SUPPORT');
      await request(server).get('/api/v1/admin/reports').set(adminAuth(support)).expect(200);
      await request(server)
        .patch(`/api/v1/admin/reports/${reportId}`)
        .set(adminAuth(support))
        .send({ status: 'DISMISSED' })
        .expect(403);
      await request(server)
        .get('/api/v1/admin/moderation/photos')
        .set(adminAuth(support))
        .expect(403);

      const moderator = await createAdmin(app, 'MODERATOR');
      const ban = { action: 'BAN', reason: 'Tekrarlanan taciz' };
      expect(
        (
          await request(server)
            .post(`/api/v1/admin/users/${b.userId}/actions`)
            .set(adminAuth(moderator))
            .send(ban)
            .expect(403)
        ).body.error.code,
      ).toBe('ADMIN_FORBIDDEN');
      await request(server).get('/api/v1/admin/audit-logs').set(adminAuth(moderator)).expect(403);

      const admin = await createAdmin(app, 'ADMIN');
      const res = await request(server)
        .post(`/api/v1/admin/users/${b.userId}/actions`)
        .set(adminAuth(admin))
        .send(ban)
        .expect(201);
      expect(res.body.data.status).toBe('BANNED');
      const me = await request(server).get('/api/v1/users/me').set(b.auth).expect(401);
      expect(me.body.error.code).toBe('SESSION_REVOKED');
    });
  });

  describe('moderasyon', () => {
    it('şikayet kuyruğu öncelik sırasıyla; karar kanıt silme tarihini ve denetim kaydını oluşturur', async () => {
      const a = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      const b = await makeUser(app, { gender: 'MAN', seeking: ['WOMAN'], place: PLACES.besiktas });
      const low = (await userReport(a, b, 'OTHER')).body.data.id;
      const high = (await userReport(b, a, 'VIOLENCE_THREAT')).body.data.id;

      const moderator = await createAdmin(app, 'MODERATOR');
      const queue = await request(server)
        .get('/api/v1/admin/reports')
        .set(adminAuth(moderator))
        .expect(200);
      expect(queue.body.data.map((r: { id: string }) => r.id)).toEqual([high, low]);

      const detail = await request(server)
        .get(`/api/v1/admin/reports/${high}`)
        .set(adminAuth(moderator))
        .expect(200);
      expect(detail.body.data.evidence.profile).toBeTruthy();

      const closed = await request(server)
        .patch(`/api/v1/admin/reports/${high}`)
        .set(adminAuth(moderator))
        .send({ status: 'ACTION_TAKEN', note: 'Hesap askıya alındı' })
        .expect(200);
      expect(closed.body.data).toMatchObject({
        status: 'ACTION_TAKEN',
        handledBy: moderator.email,
      });
      const row = await prisma.report.findUniqueOrThrow({ where: { id: high } });
      expect((row.evidencePurgeAt!.getTime() - Date.now()) / 86_400_000).toBeGreaterThan(729);

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'report.action_taken', targetId: high },
      });
      expect(log.adminId).toBe(moderator.id);
      await expect(
        prisma.$executeRaw`UPDATE "AuditLog" SET "action" = 'sahte' WHERE "id" = ${log.id}::uuid`,
      ).rejects.toThrow(/yalnızca ekleme/);
    });

    it('inceleme bekleyen fotoğraf onaylanınca keşfette görünür', async () => {
      const viewer = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      const candidate = await makeUser(app, {
        gender: 'MAN',
        seeking: ['WOMAN'],
        photoStatus: 'NEEDS_REVIEW',
        place: PLACES.besiktas,
      });
      expect(await candidateIds(app, viewer)).toEqual([]);
      const moderator = await createAdmin(app, 'MODERATOR');
      const queue = await request(server)
        .get('/api/v1/admin/moderation/photos')
        .set(adminAuth(moderator))
        .expect(200);
      expect(queue.body.data).toHaveLength(1);
      await request(server)
        .post(`/api/v1/admin/moderation/photos/${queue.body.data[0].id}`)
        .set(adminAuth(moderator))
        .send({ decision: 'APPROVED' })
        .expect(204);
      expect(await candidateIds(app, viewer)).toEqual([candidate.userId]);
    });

    it('doğrulama istenen hesap keşfetten çıkar; selfie onayıyla rozet alır ve geri döner', async () => {
      const viewer = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      const suspect = await makeUser(app, {
        gender: 'MAN',
        seeking: ['WOMAN'],
        place: PLACES.besiktas,
      });
      const moderator = await createAdmin(app, 'MODERATOR');
      await request(server)
        .post(`/api/v1/admin/users/${suspect.userId}/actions`)
        .set(adminAuth(moderator))
        .send({ action: 'REQUIRE_VERIFICATION', reason: 'Sahte profil şüphesi' })
        .expect(201);
      expect(await candidateIds(app, viewer)).toEqual([]);
      const status = await request(server)
        .get('/api/v1/discovery/status')
        .set(suspect.auth)
        .expect(200);
      expect(status.body.data.missing).toContain('VERIFICATION');

      const file = await testJpeg(600, 800);
      const up = await request(server)
        .post('/api/v1/safety/verification/upload-url')
        .set(suspect.auth)
        .send({ contentType: 'image/jpeg', sizeBytes: file.length })
        .expect(201);
      await fetch(up.body.data.uploadUrl, {
        method: 'PUT',
        body: new Uint8Array(file),
        headers: up.body.data.uploadHeaders,
      });
      await request(server)
        .post(`/api/v1/safety/verification/${up.body.data.verificationId}/submit`)
        .set(suspect.auth)
        .expect(200);

      const queue = await request(server)
        .get('/api/v1/admin/verifications')
        .set(adminAuth(moderator))
        .expect(200);
      expect(queue.body.data[0]).toMatchObject({ userId: suspect.userId });
      expect(queue.body.data[0].selfieUrl).toMatch(/^http/);
      await request(server)
        .post(`/api/v1/admin/verifications/${queue.body.data[0].id}`)
        .set(adminAuth(moderator))
        .send({ decision: 'APPROVED' })
        .expect(204);

      const cards = await request(server)
        .get('/api/v1/discovery/candidates')
        .set(viewer.auth)
        .expect(200);
      expect(cards.body.data[0]).toMatchObject({ userId: suspect.userId, verified: true });
    });

    it('hesap özeti mesaj içeriği göstermez', async () => {
      const a = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      const b = await makeUser(app, { gender: 'MAN', seeking: ['WOMAN'], place: PLACES.besiktas });
      await request(server).post('/api/v1/likes').set(a.auth).send({ targetUserId: b.userId });
      const { conversationId } = (
        await request(server).post('/api/v1/likes').set(b.auth).send({ targetUserId: a.userId })
      ).body.data;
      await request(server)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set(a.auth)
        .send({ id: randomUUID(), body: 'gizli-mesaj-icerigi' })
        .expect(201);
      const admin = await createAdmin(app, 'ADMIN');
      const res = await request(server)
        .get(`/api/v1/admin/users/${a.userId}`)
        .set(adminAuth(admin))
        .expect(200);
      expect(JSON.stringify(res.body)).not.toContain('gizli-mesaj-icerigi');
    });
  });

  describe('5651 erişim kaydı ve saklama süreleri', () => {
    it('giriş ve veri değiştiren istekler rota şablonuyla kaydedilir; okuma istekleri kaydedilmez', async () => {
      const u = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      await request(server).get('/api/v1/users/me').set(u.auth).expect(200);
      const logs = await prisma.accessLog.findMany({
        where: { userId: u.userId },
        orderBy: { id: 'asc' },
      });
      const actions = logs.map((l) => l.action);
      expect(actions).toContain('auth.login');
      expect(actions).toContain('PUT /api/v1/profiles/me/location');
      expect(actions.some((a) => a.startsWith('GET'))).toBe(false);
      expect(logs.every((l) => l.ipAddress.length > 0)).toBe(true);
      await expect(prisma.$executeRaw`UPDATE "AccessLog" SET "action" = 'x'`).rejects.toThrow(
        /yalnızca ekleme/,
      );
    });

    it('süresi dolan erişim kaydı, kanıt ve selfie silinir', async () => {
      const u = await signIn(app);
      await prisma.accessLog.create({
        data: {
          userId: u.userId,
          ipAddress: '1.2.3.4',
          action: 'eski',
          createdAt: new Date(Date.now() - 800 * 86_400_000),
        },
      });
      await storage.write('evidence/eski-sikayet/photo-0.jpg', await testJpeg(), 'image/jpeg');
      const report = await prisma.report.create({
        data: {
          reporterId: u.userId,
          reason: 'OTHER',
          targetType: 'PROFILE',
          priority: 1,
          evidence: { photoKeys: [] },
          evidencePurgeAt: new Date(Date.now() - 1000),
        },
      });
      await storage.write(`evidence/${report.id}/photo-0.jpg`, await testJpeg(), 'image/jpeg');

      const result = await app.get(RetentionService).run();
      expect(result.accessLogs).toBeGreaterThanOrEqual(1);
      expect(result.evidence).toBe(1);
      expect(await storage.size(`evidence/${report.id}/photo-0.jpg`)).toBeUndefined();
      expect(
        (await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).evidence,
      ).toMatchObject({ purged: true });
      expect(await prisma.accessLog.count({ where: { action: 'eski' } })).toBe(0);
      await storage.removePrefix('evidence/eski-sikayet/');
    });
  });

  describe('KVKK veri dışa aktarma', () => {
    it('kendi verisini (kendi mesajları dahil) indirir; başkasının mesajı ve telefon özeti dosyada yok', async () => {
      const a = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      const b = await makeUser(app, { gender: 'MAN', seeking: ['WOMAN'], place: PLACES.besiktas });
      await request(server).post('/api/v1/likes').set(a.auth).send({ targetUserId: b.userId });
      const { conversationId } = (
        await request(server).post('/api/v1/likes').set(b.auth).send({ targetUserId: a.userId })
      ).body.data;
      const send = (u: TestUser, body: string) =>
        request(server)
          .post(`/api/v1/conversations/${conversationId}/messages`)
          .set(u.auth)
          .send({ id: randomUUID(), body });
      await send(a, 'benim-mesajim').expect(201);
      await send(b, 'karsi-tarafin-mesaji').expect(201);

      const requested = await request(server)
        .post('/api/v1/privacy/export')
        .set(a.auth)
        .expect(202);
      expect(requested.body.data.status).toBe('REQUESTED');
      expect(await app.get(DataExportService).build(requested.body.data.id)).toBe('COMPLETED');

      const status = await request(server).get('/api/v1/privacy/export').set(a.auth).expect(200);
      expect(status.body.data.status).toBe('COMPLETED');
      const file = await (await fetch(status.body.data.downloadUrl)).text();
      expect(file).toContain('benim-mesajim');
      expect(file).not.toContain('karsi-tarafin-mesaji');
      expect(file).not.toContain('phoneHash');
      expect(JSON.parse(file).profile.locationNote).toMatch(/bulanıklaştırılmış/);
    });

    it('telefon numarası dosyada geçmez', async () => {
      const u = await signIn(app);
      const auth = bearer(u.accessToken);
      const requested = await request(server).post('/api/v1/privacy/export').set(auth).expect(202);
      await app.get(DataExportService).build(requested.body.data.id);
      const status = await request(server).get('/api/v1/privacy/export').set(auth).expect(200);
      const file = await (await fetch(status.body.data.downloadUrl)).text();
      expect(file).not.toContain(u.phone.slice(3));
    });
  });
});
