/**
 * API adresi derleme zamanında EXPO_PUBLIC_API_URL'den gömülür (bkz. .env.example).
 * Statik nokta erişimi zorunlu: process.env['X'] veya destructuring gömülmez.
 */
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;

export function resolveApiBaseUrl(raw: string | undefined): string {
  if (!raw) {
    throw new Error('EXPO_PUBLIC_API_URL tanımlı değil (apps/mobile/.env.example dosyasına bakın)');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`EXPO_PUBLIC_API_URL geçerli bir adres değil: ${raw}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('EXPO_PUBLIC_API_URL http(s) olmalı');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}/api/v1`;
}

export const API_BASE_URL = resolveApiBaseUrl(rawApiUrl);
