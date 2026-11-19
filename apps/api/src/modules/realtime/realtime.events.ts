/**
 * Sunucudan istemciye giden olaylar. İstemci yalnızca dinler; mesaj gönderimi REST üzerindendir
 * (tek doğrulama ve yetki yolu). Mesaj metinleri yalnızca sohbetin katılımcılarına gider.
 */
export const RealtimeEvent = {
  MESSAGE_NEW: 'message:new',
  MESSAGE_DELETED: 'message:deleted',
  CONVERSATION_READ: 'conversation:read',
  CONVERSATION_CLOSED: 'conversation:closed',
  MATCH_NEW: 'match:new',
} as const;

export const userRoom = (userId: string) => `user:${userId}`;
export const sessionRoom = (sessionId: string) => `session:${sessionId}`;
