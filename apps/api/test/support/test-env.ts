import { loadEnvFile } from '../../src/config/load-env-file.js';

/** E2E testlerinin bağlanacağı adresler. Geliştirme veritabanına asla dokunulmaz. */
export function resolveTestEnv(): { databaseUrl: string; redisUrl: string } {
  loadEnvFile();
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const redisUrl = process.env.TEST_REDIS_URL;
  if (!databaseUrl || !redisUrl) {
    throw new Error(
      'E2E testleri için TEST_DATABASE_URL ve TEST_REDIS_URL tanımlanmalı (.env.example)',
    );
  }
  if (databaseUrl === process.env.DATABASE_URL && process.env.CI !== 'true') {
    throw new Error('TEST_DATABASE_URL geliştirme veritabanıyla aynı olamaz');
  }
  return { databaseUrl, redisUrl };
}
