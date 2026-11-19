import type { TokenPairDto, TokenPairResponseDto } from '@vibe/api-contract';

import { ApiError, apiRequest, type ApiRequestInit } from '@/api/client';
import { deleteItem, getItem, setItem, StorageKeys } from '@/lib/secure-storage';
import { singleFlight } from '@/lib/single-flight';

import { useSessionStore } from './session-store';

/** Access token'ın bitmesine bu kadar kala önceden yenilenir. */
const REFRESH_MARGIN_MS = 30_000;

/** Sunucunun "bu oturum artık geçersiz" dediği durumlar: yerel oturum temizlenir. */
const TERMINAL_AUTH_CODES = new Set([
  'REFRESH_TOKEN_INVALID',
  'REFRESH_TOKEN_REUSED',
  'SESSION_REVOKED',
  'ACCOUNT_BANNED',
  'ACCOUNT_SUSPENDED',
]);

export async function completeSignIn(tokens: TokenPairDto): Promise<void> {
  await setItem(StorageKeys.refreshToken, tokens.refreshToken);
  useSessionStore.getState().setTokens(tokens.accessToken, tokens.accessTokenExpiresAt);
}

/** Sunucuya haber vermeden yerel oturumu kapatır (ör. hesap silindi, token çalındı). */
export async function clearLocalSession(reason?: string): Promise<void> {
  await deleteItem(StorageKeys.refreshToken);
  useSessionStore.getState().clear(reason ?? null);
}

export const refreshTokens = singleFlight(async (): Promise<void> => {
  const refreshToken = await getItem(StorageKeys.refreshToken);
  if (!refreshToken) {
    await clearLocalSession();
    throw new ApiError(401, 'REFRESH_TOKEN_INVALID', 'Oturum bulunamadı');
  }
  try {
    const res = await apiRequest<TokenPairResponseDto>('/auth/refresh', {
      method: 'POST',
      json: { refreshToken },
    });
    await completeSignIn(res.data);
  } catch (error) {
    if (error instanceof ApiError && TERMINAL_AUTH_CODES.has(error.code)) {
      await clearLocalSession(error.code === 'REFRESH_TOKEN_REUSED' ? error.message : undefined);
    }
    throw error;
  }
});

async function validAccessToken(): Promise<string> {
  const { accessToken, accessTokenExpiresAt } = useSessionStore.getState();
  if (
    accessToken &&
    accessTokenExpiresAt &&
    accessTokenExpiresAt - Date.now() > REFRESH_MARGIN_MS
  ) {
    return accessToken;
  }
  await refreshTokens();
  const refreshed = useSessionStore.getState().accessToken;
  if (!refreshed) throw new ApiError(401, 'UNAUTHENTICATED', 'Giriş gerekli');
  return refreshed;
}

/** Kimlik doğrulamalı istek: gerekirse token'ı yeniler, süresi dolmuşsa bir kez tekrar dener. */
export async function authedRequest<T>(path: `/${string}`, init: ApiRequestInit = {}): Promise<T> {
  const send = async (token: string) =>
    apiRequest<T>(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });

  try {
    return await send(await validAccessToken());
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code === 'TOKEN_EXPIRED') {
      await refreshTokens();
      return send(await validAccessToken());
    }
    if (TERMINAL_AUTH_CODES.has(error.code)) await clearLocalSession(error.message);
    throw error;
  }
}

/** Açılışta saklı oturumu geri yükler. */
export async function restoreSession(): Promise<void> {
  const store = useSessionStore.getState();
  store.setStatus('loading');
  const refreshToken = await getItem(StorageKeys.refreshToken);
  if (!refreshToken) {
    store.clear();
    return;
  }
  try {
    await refreshTokens();
  } catch (error) {
    if (error instanceof ApiError && (error.isNetworkError || error.status >= 500)) {
      // Oturum hâlâ geçerli olabilir; token silinmez, kullanıcı tekrar deneyebilir.
      useSessionStore.getState().setStatus('unreachable');
      return;
    }
    // Geçersiz oturum refreshTokens içinde zaten temizlendi.
    if (useSessionStore.getState().status === 'loading') await clearLocalSession();
  }
}

export async function signOut(): Promise<void> {
  try {
    await authedRequest<void>('/auth/logout', { method: 'POST' });
  } catch {
    // Sunucuya ulaşılamasa da yerel oturum kapatılır; refresh token 30 gün sonra kendiliğinden geçersizleşir.
  }
  await clearLocalSession();
}
