import type { ErrorResponseDto } from '@vibe/api-contract';

const API_URL = `${(import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? 'http://localhost:3000'}/api/v1`;
const TOKEN_KEY = 'vibe.admin.token';

/**
 * Yönetici oturum token'ı sessionStorage'da tutulur: sekme kapanınca silinir. Panel yalnızca
 * iç ağdan/VPN'den erişilebilir olmalı (Faz 7 altyapı); burada üçüncü taraf script yüklenmez.
 */
export const session = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; json?: unknown } = {},
): Promise<T> {
  const token = session.get();
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(init.json === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.json === undefined ? undefined : JSON.stringify(init.json),
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => undefined)) as unknown;
  if (!response.ok) {
    const error = (body as ErrorResponseDto | undefined)?.error;
    if (response.status === 401) {
      session.clear();
      window.dispatchEvent(new Event('vibe-admin-signed-out'));
    }
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? `Hata (${response.status})`,
    );
  }
  return body as T;
}

export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu';
