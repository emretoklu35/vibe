import { randomInt } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { StorageService } from '../../src/infra/storage/storage.service.js';
import { normalizeTurkishMobile } from '../../src/modules/auth/phone.js';
import { SMS_SENDER } from '../../src/modules/auth/sms/sms-sender.js';
import type { SmsCapture } from './sms-capture.js';

export type SignedIn = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  phone: string;
  isNew: boolean;
};

/** Her test kendi numarasını kullanır; rate limit ve kullanıcı çakışması olmaz. */
export function randomPhone(): string {
  return `+905${String(randomInt(0, 1e9)).padStart(9, '0')}`;
}

export function smsOf(app: NestExpressApplication): SmsCapture {
  return app.get<SmsCapture>(SMS_SENDER);
}

export async function signIn(
  app: NestExpressApplication,
  phone = randomPhone(),
): Promise<SignedIn> {
  const server = app.getHttpServer();
  await request(server).post('/api/v1/auth/otp/request').send({ phone }).expect(202);
  const res = await request(server)
    .post('/api/v1/auth/otp/verify')
    .send({
      phone,
      code: smsOf(app).lastCode(normalizeTurkishMobile(phone)!),
      deviceId: 'test-device',
    })
    .expect(200);
  return {
    userId: res.body.data.user.id,
    accessToken: res.body.data.tokens.accessToken,
    refreshToken: res.body.data.tokens.refreshToken,
    phone: normalizeTurkishMobile(phone)!,
    isNew: res.body.data.user.isNew,
  };
}

/** Doğum tarihi + zorunlu rızalar verilmiş kullanıcı (sıradaki adım: PROFILE). */
export async function signInWithConsents(app: NestExpressApplication): Promise<SignedIn> {
  const session = await signIn(app);
  const server = app.getHttpServer();
  const auth = { Authorization: `Bearer ${session.accessToken}` };
  await request(server)
    .patch('/api/v1/users/me')
    .set(auth)
    .send({ birthDate: '1995-04-23' })
    .expect(200);
  const config = await request(server).get('/api/v1/app/config').expect(200);
  const decisions = (
    config.body.data.legalDocuments as { type: string; version: string; required: boolean }[]
  )
    .filter((d) => d.required)
    .map((d) => ({ type: d.type, granted: true, textVersion: d.version }));
  await request(server).post('/api/v1/privacy/consents').set(auth).send({ decisions }).expect(200);
  return session;
}

/** İzin verilen bir hukuki metne rıza verir (ör. SPECIAL_CATEGORY_ORIENTATION). */
export async function grantConsent(
  app: NestExpressApplication,
  accessToken: string,
  type: string,
  granted = true,
): Promise<void> {
  const server = app.getHttpServer();
  const config = await request(server).get('/api/v1/app/config').expect(200);
  const doc = (config.body.data.legalDocuments as { type: string; version: string }[]).find(
    (d) => d.type === type,
  );
  if (!doc) throw new Error(`Belge yok: ${type}`);
  await request(server)
    .post('/api/v1/privacy/consents')
    .set(bearer(accessToken))
    .send({ decisions: [{ type, granted, textVersion: doc.version }] })
    .expect(200);
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function resetDatabase(app: NestExpressApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe('TRUNCATE "User", "DataRequest" CASCADE');
  // Test bucket'ındaki kullanıcı medyası da temizlenir.
  await app.get(StorageService).removePrefix('users/');
}
