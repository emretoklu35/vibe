import type { QueryClient } from '@tanstack/react-query';
import type { MessageDto } from '@vibe/api-contract';
import { io, type Socket } from 'socket.io-client';

import { API_BASE_URL } from '@/api/config';
import {
  conversationKey,
  conversationsKey,
  markDeleted,
  upsertMessage,
} from '@/features/chat/cache';
import { matchesKey } from '@/features/discovery/query-keys';
import { refreshTokens, validAccessToken } from '@/features/session/session';

/** API kökü (…/api/v1 olmadan); Socket.IO yolu /ws. */
const SOCKET_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '');

/**
 * Oturum açıkken tek bir socket bağlantısı. Sunucudan gelen olaylar TanStack Query önbelleğine yazılır;
 * ekranlar ayrıca dinleyici kurmaz. Mesaj gönderimi REST ile yapılır.
 */
export function connectRealtime(queryClient: QueryClient): () => void {
  const socket: Socket = io(SOCKET_ORIGIN, {
    path: '/ws',
    // Mobil ve çok süreçli sunucuda sticky session gerekmesin diye yalnızca websocket.
    transports: ['websocket'],
    // Her (yeniden) bağlantıda geçerli bir access token alınır.
    auth: (cb) => {
      validAccessToken()
        .then((token) => cb({ token }))
        .catch(() => cb({}));
    },
    reconnectionDelayMax: 10_000,
  });

  socket.on('connect_error', (error) => {
    // Token süresi bittiyse yenileyip tekrar dene; oturum geçersizse session katmanı çıkış yapar.
    if (error.message === 'TOKEN_EXPIRED') {
      void refreshTokens()
        .then(() => socket.connect())
        .catch(() => undefined);
    }
  });

  socket.on('message:new', (message: MessageDto) => {
    upsertMessage(queryClient, message);
    void queryClient.invalidateQueries({ queryKey: conversationsKey });
  });
  socket.on(
    'message:deleted',
    ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      markDeleted(queryClient, conversationId, messageId);
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
    },
  );
  socket.on('conversation:read', ({ conversationId }: { conversationId: string }) => {
    void queryClient.invalidateQueries({ queryKey: conversationKey(conversationId) });
    void queryClient.invalidateQueries({ queryKey: conversationsKey });
  });
  socket.on('conversation:closed', ({ conversationId }: { conversationId: string }) => {
    void queryClient.invalidateQueries({ queryKey: conversationKey(conversationId) });
    void queryClient.invalidateQueries({ queryKey: conversationsKey });
    void queryClient.invalidateQueries({ queryKey: matchesKey });
  });
  socket.on('match:new', () => {
    void queryClient.invalidateQueries({ queryKey: conversationsKey });
    void queryClient.invalidateQueries({ queryKey: matchesKey });
  });

  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}
