import { defineConfig } from 'prisma/config';

import { loadEnvFile } from './src/config/load-env-file.js';

loadEnvFile();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` (postinstall) bağlantı gerektirmez; .env olmadan da kurulum tamamlanabilsin.
    // migrate/seed gibi komutlar URL yoksa Prisma'nın kendi hatasıyla durur.
    url: process.env.DATABASE_URL ?? '',
  },
});
