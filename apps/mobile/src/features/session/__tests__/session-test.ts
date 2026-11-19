import { ApiError } from '@/api/client';

import { authedRequest, completeSignIn, refreshTokens, restoreSession } from '../session';
import { useSessionStore } from '../session-store';

const mockStorage = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockStorage.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockStorage.delete(key)),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-device-id' }));

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let handler: (call: Call) => { status: number; body?: unknown };

function respond(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const future = (ms: number) => new Date(Date.now() + ms).toISOString();
const tokens = (n: number) => ({
  accessToken: `access-${n}`,
  accessTokenExpiresAt: future(15 * 60_000),
  refreshToken: `refresh-${n}`,
  refreshTokenExpiresAt: future(30 * 86_400_000),
});

beforeEach(() => {
  mockStorage.clear();
  calls = [];
  useSessionStore.getState().clear();
  globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
    const call = { url: String(url), init };
    calls.push(call);
    const { status, body } = handler(call);
    return respond(status, body);
  }) as unknown as typeof fetch;
});

const refreshCalls = () => calls.filter((c) => c.url.endsWith('/auth/refresh'));

describe('oturum ve token yenileme', () => {
  it('giriş: refresh token güvenli depoya, access token belleğe', async () => {
    await completeSignIn(tokens(1));
    expect(mockStorage.get('vibe.refreshToken')).toBe('refresh-1');
    expect(useSessionStore.getState()).toMatchObject({
      status: 'signedIn',
      accessToken: 'access-1',
    });
  });

  it('eşzamanlı istekler tek bir yenileme yapar (token çalınma alarmını tetiklemez)', async () => {
    mockStorage.set('vibe.refreshToken', 'refresh-1');
    handler = ({ url }) =>
      url.endsWith('/auth/refresh')
        ? { status: 200, body: { data: tokens(2) } }
        : { status: 200, body: { data: 'ok' } };

    await Promise.all([
      authedRequest('/users/me'),
      authedRequest('/auth/sessions'),
      refreshTokens(),
    ]);
    expect(refreshCalls()).toHaveLength(1);
    expect(mockStorage.get('vibe.refreshToken')).toBe('refresh-2');
    const authHeaders = calls
      .filter((c) => !c.url.endsWith('/auth/refresh'))
      .map((c) => (c.init.headers as Record<string, string>).Authorization);
    expect(authHeaders).toEqual(['Bearer access-2', 'Bearer access-2']);
  });

  it('TOKEN_EXPIRED alınca yenileyip isteği bir kez tekrarlar', async () => {
    await completeSignIn(tokens(1));
    let meCalls = 0;
    handler = ({ url }) => {
      if (url.endsWith('/auth/refresh')) return { status: 200, body: { data: tokens(2) } };
      meCalls += 1;
      return meCalls === 1
        ? {
            status: 401,
            body: { error: { code: 'TOKEN_EXPIRED', message: 'Oturum süresi doldu' } },
          }
        : { status: 200, body: { data: { id: 'u1' } } };
    };
    await expect(authedRequest('/users/me')).resolves.toEqual({ data: { id: 'u1' } });
    expect(refreshCalls()).toHaveLength(1);
  });

  it('REFRESH_TOKEN_REUSED: yerel oturum silinir ve sebep saklanır', async () => {
    mockStorage.set('vibe.refreshToken', 'refresh-1');
    handler = () => ({
      status: 401,
      body: {
        error: { code: 'REFRESH_TOKEN_REUSED', message: 'Güvenlik nedeniyle oturum kapatıldı' },
      },
    });
    await expect(refreshTokens()).rejects.toBeInstanceOf(ApiError);
    expect(mockStorage.has('vibe.refreshToken')).toBe(false);
    expect(useSessionStore.getState()).toMatchObject({
      status: 'signedOut',
      signOutReason: 'Güvenlik nedeniyle oturum kapatıldı',
    });
  });

  it('açılışta sunucuya ulaşılamazsa oturum silinmez, "unreachable" olur', async () => {
    mockStorage.set('vibe.refreshToken', 'refresh-1');
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await restoreSession();
    expect(useSessionStore.getState().status).toBe('unreachable');
    expect(mockStorage.get('vibe.refreshToken')).toBe('refresh-1');
  });

  it('açılışta saklı token yoksa çıkış yapılmış sayılır, ağ çağrısı yapılmaz', async () => {
    await restoreSession();
    expect(useSessionStore.getState().status).toBe('signedOut');
    expect(calls).toHaveLength(0);
  });
});
