import type { ConversationDto } from '@vibe/api-contract';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { listConversations } from '@/api/chat';
import { Button } from '@/design/components/button';
import { Notice } from '@/design/components/notice';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { formatDate } from '@/features/account/format';
import { describeError } from '@/features/auth/error-message';
import { conversationsKey } from '@/features/chat/cache';
import { useMe } from '@/features/session/use-me';

/** Her eşleşmenin bir sohbeti vardır; bu sekme sohbetleri son mesaja göre listeler. */
export default function MatchesScreen() {
  const theme = useTheme();
  const conversations = useInfiniteQuery({
    queryKey: conversationsKey,
    queryFn: ({ pageParam }) => listConversations(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const items = conversations.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{
          paddingVertical: theme.spacing.xxl,
          gap: theme.spacing.md,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <Text
            variant="title"
            accessibilityRole="header"
            style={{ marginBottom: theme.spacing.md }}
          >
            Eşleşmeler
          </Text>
        }
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        onEndReached={() => {
          if (conversations.hasNextPage && !conversations.isFetchingNextPage)
            void conversations.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={conversations.isRefetching}
            onRefresh={() => void conversations.refetch()}
            tintColor={theme.colors.accent}
          />
        }
        ListEmptyComponent={
          conversations.isPending ? (
            <ActivityIndicator />
          ) : conversations.isError ? (
            <Notice message={describeError(conversations.error)} />
          ) : (
            <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.xl }}>
              <Text variant="headline">Henüz eşleşmen yok</Text>
              <Text color="textMuted">
                Keşfette birini beğendiğinde, o da seni beğenirse burada görünür.
              </Text>
              <Button
                label="Keşfete git"
                variant="secondary"
                onPress={() => router.navigate('/discover')}
              />
            </View>
          )
        }
        ListFooterComponent={conversations.isFetchingNextPage ? <ActivityIndicator /> : undefined}
      />
    </Screen>
  );
}

function ConversationRow({ conversation }: { conversation: ConversationDto }) {
  const theme = useTheme();
  const me = useMe();
  const { otherUser, lastMessage, unreadCount } = conversation;
  const preview = lastMessage
    ? lastMessage.deletedAt
      ? 'Bu mesaj silindi'
      : `${lastMessage.senderId === me.data?.id ? 'Sen: ' : ''}${lastMessage.body}`
    : `${formatDate(conversation.createdAt)} tarihinde eşleştiniz · ilk mesajı gönder`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${otherUser.displayName}${unreadCount > 0 ? `, ${unreadCount} okunmamış mesaj` : ''}`}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: conversation.id } })}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceRaised }]}>
        {otherUser.photoUrl ? (
          <Image
            source={{ uri: otherUser.photoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
      </View>
      <View style={styles.flex}>
        <Text variant="headline">
          {otherUser.displayName}, {otherUser.age}
        </Text>
        <Text variant="caption" color={unreadCount > 0 ? 'text' : 'textMuted'} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      {unreadCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
          <Text variant="caption" color="onAccent">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden' },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
