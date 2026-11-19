import type {
  ConversationDto,
  ConversationResponseDto,
  ConversationsResponseDto,
  MessageDto,
  MessageResponseDto,
  MessagesResponseDto,
  NotificationSettingsDto,
  NotificationSettingsResponseDto,
  RegisterDeviceDto,
} from '@vibe/api-contract';

import { authedRequest } from '@/features/session/session';

const cursorQuery = (cursor?: string) => (cursor ? `?cursor=${encodeURIComponent(cursor)}` : '');

export const listConversations = (cursor?: string) =>
  authedRequest<ConversationsResponseDto>(`/conversations${cursorQuery(cursor)}`);

export const getConversation = async (id: string): Promise<ConversationDto> =>
  (await authedRequest<ConversationResponseDto>(`/conversations/${encodeURIComponent(id)}`)).data;

export const listMessages = (id: string, cursor?: string) =>
  authedRequest<MessagesResponseDto>(
    `/conversations/${encodeURIComponent(id)}/messages${cursorQuery(cursor)}`,
  );

export const sendMessage = async (
  conversationId: string,
  id: string,
  body: string,
): Promise<MessageDto> =>
  (
    await authedRequest<MessageResponseDto>(
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        json: { id, body },
      },
    )
  ).data;

export const markRead = (conversationId: string, lastReadMessageId: string) =>
  authedRequest<void>(`/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'POST',
    json: { lastReadMessageId },
  });

export const deleteMessage = (conversationId: string, messageId: string) =>
  authedRequest<void>(
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
  );

export const registerDevice = (input: RegisterDeviceDto) =>
  authedRequest<unknown>('/devices', { method: 'POST', json: input });

export const getNotificationSettings = async (): Promise<NotificationSettingsDto> =>
  (await authedRequest<NotificationSettingsResponseDto>('/notifications/settings')).data;

export const setNotificationSettings = async (
  input: NotificationSettingsDto,
): Promise<NotificationSettingsDto> =>
  (
    await authedRequest<NotificationSettingsResponseDto>('/notifications/settings', {
      method: 'PUT',
      json: input,
    })
  ).data;
