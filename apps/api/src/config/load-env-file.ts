import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

/**
 * Varsa çalışma dizinindeki `.env` dosyasını yükler.
 * Ortamda zaten tanımlı değişkenler ezilmez (CI ve production ortam değişkenleri önceliklidir).
 */
export function loadEnvFile(path = resolve(process.cwd(), '.env')): void {
  if (!existsSync(path)) return;
  const parsed = parseEnv(readFileSync(path, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
