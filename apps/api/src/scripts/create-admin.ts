/**
 * Yönetici hesabı oluşturur. Kayıt ekranı yoktur; hesaplar yalnızca sunucuya erişimi olan kişi
 * tarafından bu komutla açılır.
 *
 *   npm run admin:create --workspace @vibe/api -- --email moderator@ornek.com --role MODERATOR
 *
 * Güçlü bir parola ve TOTP anahtarı üretilir ve YALNIZCA BİR KEZ ekrana yazılır. TOTP anahtarını
 * kimlik doğrulama uygulamasına ekleyin (otpauth adresi veya elle anahtar), parolayı parola yöneticisine kaydedin.
 */
import 'reflect-metadata';

import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';

import { PrismaPg } from '@prisma/adapter-pg';

import { loadEnvFile } from '../config/load-env-file.js';
import { parseEnv } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { AdminRole } from '../generated/prisma/enums.js';
import { SecretBoxService } from '../infra/crypto/secret-box.service.js';
import { TOTP_PURPOSE } from '../modules/admin/auth/admin-auth.service.js';
import { hashPassword } from '../modules/admin/auth/password.js';
import { base32Encode, generateTotpSecret, otpauthUri } from '../modules/admin/auth/totp.js';

loadEnvFile();
const config = parseEnv(process.env);

const { values } = parseArgs({
  options: { email: { type: 'string' }, role: { type: 'string', default: 'MODERATOR' } },
});
const email = values.email?.trim().toLowerCase();
const role = values.role as AdminRole;
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Geçerli bir --email verin');
  process.exit(1);
}
if (!Object.values(AdminRole).includes(role)) {
  console.error(`--role şunlardan biri olmalı: ${Object.values(AdminRole).join(', ')}`);
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.DATABASE_URL }),
});
try {
  if (await prisma.adminUser.findUnique({ where: { email } })) {
    console.error('Bu e-posta ile bir yönetici zaten var');
    process.exit(1);
  }
  const password = randomBytes(18).toString('base64url');
  const totpSecret = generateTotpSecret();
  await prisma.adminUser.create({
    data: {
      email,
      role,
      passwordHash: await hashPassword(password),
      totpSecretEncrypted: new Uint8Array(
        new SecretBoxService(config).encrypt(TOTP_PURPOSE, totpSecret),
      ),
    },
  });
  console.log(`\nYönetici oluşturuldu: ${email} (${role})`);
  console.log('Aşağıdaki bilgiler YALNIZCA BİR KEZ gösterilir:\n');
  console.log(`  Parola       : ${password}`);
  console.log(`  TOTP anahtarı: ${base32Encode(totpSecret)}`);
  console.log(`  otpauth      : ${otpauthUri(totpSecret, email)}\n`);
} finally {
  await prisma.$disconnect();
}
