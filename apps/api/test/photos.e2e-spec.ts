import type { NestExpressApplication } from '@nestjs/platform-express';
import { Redis } from 'ioredis';
import sharp from 'sharp';
import request from 'supertest';

import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { REDIS } from '../src/infra/redis/redis.module.js';
import { StorageService } from '../src/infra/storage/storage.service.js';
import { PhotoProcessingService } from '../src/modules/media/photo-processing.service.js';
import { AccountDeletionService } from '../src/modules/users/account-deletion.service.js';
import {
  bearer,
  resetDatabase,
  signInWithConsents,
  type SignedIn,
} from './support/auth-helpers.js';
import { createTestApp } from './support/create-test-app.js';
import { processPhoto, testJpeg, uploadPhoto, validProfile } from './support/media-helpers.js';

describe('Fotoğraflar: yükleme, işleme, sıralama, silme', () => {
  let app: NestExpressApplication;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let prisma: PrismaService;
  let storage: StorageService;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
    await resetDatabase(app);
  });

  beforeEach(async () => {
    await app.get<Redis>(REDIS).flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  async function userWithProfile(): Promise<SignedIn> {
    const s = await signInWithConsents(app);
    await request(server)
      .put('/api/v1/profiles/me')
      .set(bearer(s.accessToken))
      .send(validProfile)
      .expect(200);
    return s;
  }

  it('profil olmadan yükleme adresi verilmez → PROFILE_REQUIRED', async () => {
    const s = await signInWithConsents(app);
    const res = await request(server)
      .post('/api/v1/profiles/me/photos/upload-url')
      .set(bearer(s.accessToken))
      .send({ contentType: 'image/jpeg', sizeBytes: 1000 })
      .expect(409);
    expect(res.body.error.code).toBe('PROFILE_REQUIRED');
  });

  it.each([
    ['GIF türü', { contentType: 'image/gif', sizeBytes: 1000 }],
    ['10 MB üstü', { contentType: 'image/jpeg', sizeBytes: 10 * 1024 * 1024 + 1 }],
    ['sıfır bayt', { contentType: 'image/jpeg', sizeBytes: 0 }],
  ])('%s → VALIDATION_FAILED', async (_label, body) => {
    const s = await userWithProfile();
    const res = await request(server)
      .post('/api/v1/profiles/me/photos/upload-url')
      .set(bearer(s.accessToken))
      .send(body)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('tam akış: yükle → PROCESSING → işle → APPROVED; EXIF temizlenmiş JPEG sunulur, ham dosya silinir', async () => {
    const s = await userWithProfile();
    const original = await testJpeg(2400, 3000, { Copyright: 'gizli-gps-bilgisi' });
    const photo = await uploadPhoto(app, s.accessToken, original);
    expect(photo).toMatchObject({ status: 'PROCESSING', url: null });

    const row = await prisma.profilePhoto.findUniqueOrThrow({ where: { id: photo.id } });
    expect(await storage.size(row.uploadKey!)).toBeGreaterThan(0);

    expect(await processPhoto(app, photo.id)).toBe('APPROVED');

    const list = await request(server)
      .get('/api/v1/profiles/me/photos')
      .set(bearer(s.accessToken))
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    const [item] = list.body.data;
    expect(item).toMatchObject({
      id: photo.id,
      status: 'APPROVED',
      position: 0,
      width: 1280,
      height: 1600,
    });

    const served = Buffer.from(await (await fetch(item.url)).arrayBuffer());
    const meta = await sharp(served).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    expect(served.includes(Buffer.from('gizli-gps-bilgisi'))).toBe(false);

    expect(await storage.size(row.uploadKey!)).toBeUndefined();
  });

  it('görsel olmayan dosya "image/jpeg" diye yüklense de FAILED olur ve silinir', async () => {
    const s = await userWithProfile();
    const photo = await uploadPhoto(
      app,
      s.accessToken,
      Buffer.from('bu bir görsel değil'.repeat(20)),
    );
    const row = await prisma.profilePhoto.findUniqueOrThrow({ where: { id: photo.id } });
    expect(await processPhoto(app, photo.id)).toBe('FAILED');
    expect(await storage.size(row.uploadKey!)).toBeUndefined();
    const after = await prisma.profilePhoto.findUniqueOrThrow({ where: { id: photo.id } });
    expect(after.status).toBe('FAILED');
  });

  it('dosya yüklenmeden "tamamlandı" → UPLOAD_NOT_FOUND; iki kez tamamlama → PHOTO_NOT_AWAITING_UPLOAD', async () => {
    const s = await userWithProfile();
    const auth = bearer(s.accessToken);
    const created = await request(server)
      .post('/api/v1/profiles/me/photos/upload-url')
      .set(auth)
      .send({ contentType: 'image/jpeg', sizeBytes: 5000 })
      .expect(201);
    const id = created.body.data.photo.id;
    const missing = await request(server)
      .post(`/api/v1/profiles/me/photos/${id}/complete`)
      .set(auth)
      .expect(422);
    expect(missing.body.error.code).toBe('UPLOAD_NOT_FOUND');

    const photo = await uploadPhoto(app, s.accessToken, await testJpeg());
    const twice = await request(server)
      .post(`/api/v1/profiles/me/photos/${photo.id}/complete`)
      .set(auth)
      .expect(409);
    expect(twice.body.error.code).toBe('PHOTO_NOT_AWAITING_UPLOAD');
  });

  it('en fazla 6 fotoğraf', async () => {
    const s = await userWithProfile();
    const auth = bearer(s.accessToken);
    for (let i = 0; i < 6; i++) {
      await request(server)
        .post('/api/v1/profiles/me/photos/upload-url')
        .set(auth)
        .send({ contentType: 'image/jpeg', sizeBytes: 1000 })
        .expect(201);
    }
    const res = await request(server)
      .post('/api/v1/profiles/me/photos/upload-url')
      .set(auth)
      .send({ contentType: 'image/jpeg', sizeBytes: 1000 })
      .expect(422);
    expect(res.body.error.code).toBe('PHOTO_LIMIT_REACHED');
  });

  it('başkasının fotoğrafına erişim → 404 (tamamlama, silme, sıralama)', async () => {
    const owner = await userWithProfile();
    const other = await userWithProfile();
    const photo = await uploadPhoto(app, owner.accessToken, await testJpeg());
    await processPhoto(app, photo.id);
    const auth = bearer(other.accessToken);

    await request(server)
      .post(`/api/v1/profiles/me/photos/${photo.id}/complete`)
      .set(auth)
      .expect(404);
    await request(server).delete(`/api/v1/profiles/me/photos/${photo.id}`).set(auth).expect(404);
    await request(server)
      .patch('/api/v1/profiles/me/photos/order')
      .set(auth)
      .send({ photoIds: [photo.id] })
      .expect(400);
    expect(await prisma.profilePhoto.count({ where: { id: photo.id } })).toBe(1);
  });

  it('sıralama ve silme: pozisyonlar sıkıştırılır, dosyalar depolamadan silinir', async () => {
    const s = await userWithProfile();
    const auth = bearer(s.accessToken);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const p = await uploadPhoto(app, s.accessToken, await testJpeg());
      await processPhoto(app, p.id);
      ids.push(p.id);
    }

    const wrong = await request(server)
      .patch('/api/v1/profiles/me/photos/order')
      .set(auth)
      .send({ photoIds: ids.slice(0, 2) })
      .expect(400);
    expect(wrong.body.error.code).toBe('INVALID_PHOTO_ORDER');

    const reordered = await request(server)
      .patch('/api/v1/profiles/me/photos/order')
      .set(auth)
      .send({ photoIds: [ids[2], ids[0], ids[1]] })
      .expect(200);
    expect((reordered.body.data as { id: string }[]).map((p) => p.id)).toEqual([
      ids[2],
      ids[0],
      ids[1],
    ]);

    const removedKey = (await prisma.profilePhoto.findUniqueOrThrow({ where: { id: ids[2]! } }))
      .storageKey;
    await request(server).delete(`/api/v1/profiles/me/photos/${ids[2]}`).set(auth).expect(204);
    expect(await storage.size(removedKey)).toBeUndefined();

    const list = await request(server).get('/api/v1/profiles/me/photos').set(auth).expect(200);
    expect(
      (list.body.data as { id: string; position: number }[]).map((p) => [p.id, p.position]),
    ).toEqual([
      [ids[0], 0],
      [ids[1], 1],
    ]);
  });

  it('yarım kalan yüklemeler 1 saat sonra temizlenir', async () => {
    const s = await userWithProfile();
    const created = await request(server)
      .post('/api/v1/profiles/me/photos/upload-url')
      .set(bearer(s.accessToken))
      .send({ contentType: 'image/jpeg', sizeBytes: 1000 })
      .expect(201);
    const id = created.body.data.photo.id;
    const removed = await app
      .get(PhotoProcessingService)
      .cleanupStaleUploads(new Date(Date.now() + 2 * 3600_000));
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await prisma.profilePhoto.count({ where: { id } })).toBe(0);
  });

  it('hesap kalıcı silinince tüm medyası depolamadan silinir', async () => {
    const s = await userWithProfile();
    const photo = await uploadPhoto(app, s.accessToken, await testJpeg());
    await processPhoto(app, photo.id);
    const key = (await prisma.profilePhoto.findUniqueOrThrow({ where: { id: photo.id } }))
      .storageKey;
    expect(await storage.size(key)).toBeGreaterThan(0);

    await request(server).delete('/api/v1/users/me').set(bearer(s.accessToken)).expect(202);
    await app.get(AccountDeletionService).purgeDue(new Date(Date.now() + 31 * 86_400_000));

    expect(await prisma.user.count({ where: { id: s.userId } })).toBe(0);
    expect(await storage.size(key)).toBeUndefined();
  });
});
