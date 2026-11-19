import { randomBytes } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import type { AdminRole } from '../../src/generated/prisma/enums.js';
import { SecretBoxService } from '../../src/infra/crypto/secret-box.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { TOTP_PURPOSE } from '../../src/modules/admin/auth/admin-auth.service.js';
import { hashPassword } from '../../src/modules/admin/auth/password.js';
import { generateTotpSecret, totp } from '../../src/modules/admin/auth/totp.js';

export type TestAdmin = {
  id: string;
  email: string;
  password: string;
  secret: Buffer;
  token: string;
};

/** Komut satırı aracının yaptığını yapar ve gerçek giriş ucuyla oturum açar. */
export async function createAdmin(
  app: NestExpressApplication,
  role: AdminRole,
): Promise<TestAdmin> {
  const prisma = app.get(PrismaService);
  const email = `${role.toLowerCase()}-${randomBytes(4).toString('hex')}@vibe.test`;
  const password = randomBytes(12).toString('base64url');
  const secret = generateTotpSecret();
  const admin = await prisma.adminUser.create({
    data: {
      email,
      role,
      passwordHash: await hashPassword(password),
      totpSecretEncrypted: new Uint8Array(app.get(SecretBoxService).encrypt(TOTP_PURPOSE, secret)),
    },
  });
  const res = await request(app.getHttpServer())
    .post('/api/v1/admin/auth/login')
    .send({ email, password, totp: totp(secret) })
    .expect(200);
  return { id: admin.id, email, password, secret, token: res.body.data.token };
}

export const adminAuth = (admin: TestAdmin) => ({ Authorization: `Bearer ${admin.token}` });
