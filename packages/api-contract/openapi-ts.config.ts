import { defineConfig } from '@hey-api/openapi-ts';

// Yalnızca TypeScript tipleri üretilir (SDK/istemci üretilmez; mobil kendi küçük istemcisini kullanır).
export default defineConfig({
  input: './openapi.json',
  output: { path: './src/generated' },
  plugins: ['@hey-api/typescript'],
});
