import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { MessageDto, MessagesResponseDto } from '@vibe/api-contract';

export const conversationsKey = ['conversations'] as const;
export const conversationKey = (id: string) => ['conversation', id] as const;
export const messagesKey = (id: string) => ['messages', id] as const;

/** Gönderimde ya da hata durumunda ekranda gösterilen yerel durum. Sunucu mesajlarında undefined. */
export type LocalStatus = 'sending' | 'failed';
export type ChatMessage = MessageDto & { localStatus?: LocalStatus };
type Pages = InfiniteData<MessagesResponseDto & { data: ChatMessage[] }, string | undefined>;

/**
 * Mesajı önbelleğe ekler ya da aynı kimlikli olanı günceller (idempotent: socket ve REST yanıtı aynı
 * mesajı iki kez getirse de liste bozulmaz). Sayfalar en yeni önce sıralıdır.
 */
export function upsertMessage(client: QueryClient, message: ChatMessage): void {
  client.setQueryData<Pages>(messagesKey(message.conversationId), (data) => {
    if (!data) return data;
    let found = false;
    const pages = data.pages.map((page) => ({
      ...page,
      data: page.data.map((m) => {
        if (m.id !== message.id) return m;
        found = true;
        return message;
      }),
    }));
    if (!found && pages[0]) pages[0] = { ...pages[0], data: [message, ...pages[0].data] };
    return { ...data, pages };
  });
}

export function markDeleted(client: QueryClient, conversationId: string, messageId: string): void {
  client.setQueryData<Pages>(messagesKey(conversationId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            data: page.data.map((m) =>
              m.id === messageId ? { ...m, body: '', deletedAt: new Date().toISOString() } : m,
            ),
          })),
        }
      : data,
  );
}

export function flattenMessages(
  data: InfiniteData<MessagesResponseDto & { data: ChatMessage[] }, unknown> | undefined,
): ChatMessage[] {
  return data?.pages.flatMap((p) => p.data) ?? [];
}
