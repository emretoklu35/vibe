import { create } from 'zustand';

/**
 * Oturum durumu. Access token yalnızca bellekte tutulur; refresh token secure storage'dadır.
 * - loading: açılışta saklı oturum kontrol ediliyor
 * - unreachable: saklı oturum var ama sunucuya ulaşılamadı (tekrar denenebilir)
 */
export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'unreachable';

type SessionState = {
  status: SessionStatus;
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  /** Oturum dışarıdan sonlandığında (ör. 18 yaş altı, token çalınması) gösterilecek açıklama. */
  signOutReason: string | null;
  setTokens: (accessToken: string, expiresAt: string) => void;
  setStatus: (status: SessionStatus) => void;
  clear: (reason?: string | null) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  accessToken: null,
  accessTokenExpiresAt: null,
  signOutReason: null,
  setTokens: (accessToken, expiresAt) =>
    set({
      accessToken,
      accessTokenExpiresAt: new Date(expiresAt).getTime(),
      status: 'signedIn',
      signOutReason: null,
    }),
  setStatus: (status) => set({ status }),
  clear: (reason = null) =>
    set({
      status: 'signedOut',
      accessToken: null,
      accessTokenExpiresAt: null,
      signOutReason: reason,
    }),
}));
