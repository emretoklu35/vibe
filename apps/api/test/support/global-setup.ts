import { execFileSync } from 'node:child_process';

import { resolveTestEnv } from './test-env.js';

/** Test veritabanını en güncel migration'a getirir (prisma migrate deploy). */
export default function setup(): void {
  const { databaseUrl } = resolveTestEnv();
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
