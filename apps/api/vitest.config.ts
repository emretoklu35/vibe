import { defineConfig } from 'vitest/config';

// Birim testleri: dış bağımlılık (DB, Redis) gerektirmez.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'prisma/**/*.spec.ts'],
  },
});
