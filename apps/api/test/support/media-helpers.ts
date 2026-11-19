import type { NestExpressApplication } from '@nestjs/platform-express';
import sharp from 'sharp';
import request from 'supertest';

import { PhotoProcessingService } from '../../src/modules/media/photo-processing.service.js';
import { bearer } from './auth-helpers.js';

export async function testJpeg(
  width = 800,
  height = 1000,
  exif?: Record<string, string>,
): Promise<Buffer> {
  const img = sharp({ create: { width, height, channels: 3, background: '#7c5ce0' } });
  return (exif ? img.withExif({ IFD0: exif }) : img).jpeg().toBuffer();
}

/** Uygulamanın yaptığı gibi: yükleme adresi al → doğrudan S3'e PUT → tamamla. */
export async function uploadPhoto(
  app: NestExpressApplication,
  accessToken: string,
  file: Buffer,
  contentType = 'image/jpeg',
): Promise<{ id: string; status: string }> {
  const server = app.getHttpServer();
  const created = await request(server)
    .post('/api/v1/profiles/me/photos/upload-url')
    .set(bearer(accessToken))
    .send({ contentType, sizeBytes: file.length })
    .expect(201);
  const { uploadUrl, uploadHeaders, photo } = created.body.data;
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    body: new Uint8Array(file),
    headers: uploadHeaders,
  });
  if (!put.ok) throw new Error(`S3 PUT başarısız: ${put.status} ${await put.text()}`);
  const done = await request(server)
    .post(`/api/v1/profiles/me/photos/${photo.id}/complete`)
    .set(bearer(accessToken))
    .expect(200);
  return done.body.data;
}

/** Worker'ın yapacağı işi doğrudan çalıştırır. */
export function processPhoto(app: NestExpressApplication, photoId: string) {
  return app.get(PhotoProcessingService).process(photoId);
}

export const validProfile = {
  displayName: 'Deniz',
  gender: 'WOMAN',
  relationshipGoal: 'LONG_TERM',
  bio: 'Kahve, deniz ve uzun yürüyüşler.',
};
