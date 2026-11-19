import type { MessageDto } from '@vibe/api-contract';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ApiError } from '@/api/client';
import { getConversation, listMessages, markRead, sendMessage } from '@/api/chat';
import { Button } from '@/design/components/button';
import { Notice } from '@/design/components/notice';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { describeError } from '@/features/auth/error-message';
import { VerifiedBadge } from '@/features/discovery/profile-card';
import {
  type ChatMessage,
  conversationKey,
  conversationsKey,
  flattenMessages,
  messagesKey,
  upsertMessage,
} from '@/features/chat/cache';
import { useMe } from '@/features/session/use-me';

const MAX_LENGTH = 2000;
const timeFormatter = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const conversation = useQuery({
    queryKey: conversationKey(id),
    queryFn: () => getConversation(id),
  });

  if (conversation.isPending) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (conversation.isError) {
    const closed = conversation.error instanceof ApiError && conversation.error.status === 404;
    return (
      <Screen style={{ ...styles.center, gap: theme.spacing.lg }}>
        <Text variant="headline" align="center">
          {closed ? 'Bu sohbet artık açık değil' : 'Sohbet yüklenemedi'}
        </Text>
        {!closed ? <Notice message={describeError(conversation.error)} /> : null}
        <Button label="Geri" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }
  return <Chat conversationId={id} />;
}

function Chat({ conversationId }: { conversationId: string }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const me = useMe();
  const myId = me.data?.id;
  const conversation = useQuery({
    queryKey: conversationKey(conversationId),
    queryFn: () => getConversation(conversationId),
  });
  const messages = useInfiniteQuery({
    queryKey: messagesKey(conversationId),
    queryFn: ({ pageParam }) => listMessages(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const [draft, setDraft] = useState('');
  const lastMarked = useRef<string | null>(null);

  const list = useMemo(() => flattenMessages(messages.data), [messages.data]);
  const other = conversation.data?.otherUser;

  // Karşı tarafın en yeni mesajı ekrandayken okundu bilgisi gönderilir.
  const newestFromOther = list.find((m) => m.senderId && m.senderId !== myId && !m.localStatus);
  useFocusEffect(
    useCallback(() => {
      if (!newestFromOther || lastMarked.current === newestFromOther.id) return;
      lastMarked.current = newestFromOther.id;
      void markRead(conversationId, newestFromOther.id).then(() =>
        queryClient.invalidateQueries({ queryKey: conversationsKey }),
      );
    }, [newestFromOther, conversationId, queryClient]),
  );

  const send = useMutation({
    mutationFn: (message: ChatMessage) => sendMessage(conversationId, message.id, message.body),
    onMutate: (message) => upsertMessage(queryClient, { ...message, localStatus: 'sending' }),
    onSuccess: (saved) => {
      upsertMessage(queryClient, saved);
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
    },
    onError: (_error, message) => upsertMessage(queryClient, { ...message, localStatus: 'failed' }),
  });

  const submit = () => {
    const body = draft.trim();
    if (!body || !myId) return;
    setDraft('');
    send.mutate({
      // İstemci kimliği: ağ hatasında aynı mesaj tekrar gönderilse de sunucuda tek kayıt olur.
      id: Crypto.randomUUID(),
      conversationId,
      senderId: myId,
      type: 'TEXT',
      body,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      flagged: false,
    });
  };

  const report = (userId: string, name: string, messageId?: string) =>
    router.push({
      pathname: '/report',
      params: {
        userId,
        name,
        ...(messageId ? { targetType: 'MESSAGE', targetId: messageId } : {}),
      },
    });

  // "Görüldü": karşı tarafın okuduğu, benim gönderdiğim en yeni mesaj.
  const otherReadAt = conversation.data?.otherLastReadAt
    ? new Date(conversation.data.otherLastReadAt)
    : null;
  const seenId = otherReadAt
    ? list.find(
        (m) => m.senderId === myId && !m.localStatus && new Date(m.createdAt) <= otherReadAt,
      )?.id
    : undefined;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View
        style={[
          styles.header,
          { borderColor: theme.colors.border, paddingHorizontal: theme.spacing.lg },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${other?.displayName ?? ''} profilini aç`}
          style={styles.headerUser}
          onPress={() =>
            conversation.data &&
            router.push({ pathname: '/match/[id]', params: { id: conversation.data.matchId } })
          }
        >
          <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceRaised }]}>
            {other?.photoUrl ? (
              <Image
                source={{ uri: other.photoUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : null}
          </View>
          <Text variant="headline">{other ? `${other.displayName}, ${other.age}` : ''}</Text>
          {other?.verified ? <VerifiedBadge /> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Şikayet et"
          hitSlop={10}
          onPress={() => other && report(other.userId, other.displayName)}
        >
          <Ionicons name="flag-outline" size={22} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <FlatList
          inverted
          data={list}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
          onEndReached={() => {
            if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
          }}
          renderItem={({ item }) => (
            <Bubble
              message={item}
              mine={item.senderId === myId}
              seen={item.id === seenId}
              onRetry={() => send.mutate({ ...item, localStatus: undefined })}
              onReport={
                other && item.senderId === other.userId && !item.deletedAt
                  ? () => report(other.userId, other.displayName, item.id)
                  : undefined
              }
            />
          )}
          ListEmptyComponent={
            messages.isPending ? (
              <ActivityIndicator />
            ) : (
              <View style={[styles.empty, { gap: theme.spacing.sm }]}>
                <Text variant="headline" align="center">
                  İlk mesajı sen gönder
                </Text>
                <Text color="textMuted" align="center">
                  Ortak noktalarınızdan biriyle başlamak iyi bir fikir.
                </Text>
              </View>
            )
          }
        />
        {messages.isError ? <Notice message={describeError(messages.error)} /> : null}
        <View
          style={[
            styles.composer,
            { borderColor: theme.colors.border, padding: theme.spacing.md, gap: theme.spacing.sm },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Mesaj yaz"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={MAX_LENGTH}
            accessibilityLabel="Mesaj"
            style={[
              styles.input,
              theme.typography.body,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.lg,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gönder"
            accessibilityState={{ disabled: !draft.trim() }}
            disabled={!draft.trim()}
            onPress={submit}
            style={[
              styles.send,
              { backgroundColor: draft.trim() ? theme.colors.accent : theme.colors.surfaceRaised },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={22}
              color={draft.trim() ? theme.colors.onAccent : theme.colors.textMuted}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({
  message,
  mine,
  seen,
  onRetry,
  onReport,
}: {
  message: ChatMessage;
  mine: boolean;
  seen: boolean;
  onRetry: () => void;
  /** Yalnızca karşı tarafın mesajlarında: uzun basınca şikayet ekranı açılır. */
  onReport?: () => void;
}) {
  const theme = useTheme();
  const deleted = Boolean(message.deletedAt);
  const status =
    message.localStatus === 'sending'
      ? 'Gönderiliyor…'
      : message.localStatus === 'failed'
        ? 'Gönderilemedi · tekrar dene'
        : seen
          ? 'Görüldü'
          : timeFormatter.format(new Date(message.createdAt));

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 2 }}>
      <Pressable
        disabled={!onReport}
        onLongPress={onReport}
        accessibilityHint={onReport ? 'Mesajı şikayet etmek için uzun bas' : undefined}
        accessibilityActions={onReport ? [{ name: 'longpress', label: 'Şikayet et' }] : undefined}
        onAccessibilityAction={onReport}
        style={[
          styles.bubble,
          {
            borderRadius: theme.radii.lg,
            backgroundColor: mine ? theme.colors.accent : theme.colors.surface,
            opacity: message.localStatus === 'sending' ? 0.7 : 1,
          },
        ]}
      >
        <Text
          color={mine ? 'onAccent' : deleted ? 'textMuted' : 'text'}
          style={deleted ? { fontStyle: 'italic' } : undefined}
        >
          {deleted ? 'Bu mesaj silindi' : (message as MessageDto).body}
        </Text>
      </Pressable>
      {!mine && message.flagged && !deleted ? (
        <View
          style={[
            styles.warning,
            { borderColor: theme.colors.border, borderRadius: theme.radii.md },
          ]}
          accessibilityRole="alert"
        >
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.accent} />
          <Text variant="caption" color="textMuted" style={styles.flex}>
            Bu mesajda iletişim bilgisi veya bağlantı var. Tanımadığın bağlantılara dokunma, para
            veya kişisel bilgi gönderme. Seni rahatsız ederse uzun basıp şikayet edebilirsin.
          </Text>
        </View>
      ) : null}
      {message.localStatus === 'failed' ? (
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text variant="caption" color="danger">
            {status}
          </Text>
        </Pressable>
      ) : (
        <Text variant="caption" color="textMuted">
          {status}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerUser: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10 },
  warning: {
    maxWidth: '85%',
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { transform: [{ scaleY: -1 }], paddingTop: 40 },
});
