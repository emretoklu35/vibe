import { defineConfig } from 'vitest/config';

// E2E/entegrasyon testleri: gerçek PostgreSQL ve Redis (docker compose veya CI servisleri) gerekir.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/global-setup.ts'],
    setupFiles: ['./test/support/setup-env.ts'],
    // Testler aynı Redis DB'sini paylaşır; sırayla çalışmalı.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 60_000,
  },
});
