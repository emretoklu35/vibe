import type { MatchSummaryDto } from '@vibe/api-contract';
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

import { listMatches } from '@/api/discovery';
import { Button } from '@/design/components/button';
import { Notice } from '@/design/components/notice';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { formatDate } from '@/features/account/format';
import { describeError } from '@/features/auth/error-message';
import { matchesKey } from '@/features/discovery/query-keys';

export default function MatchesScreen() {
  const theme = useTheme();
  const matches = useInfiniteQuery({
    queryKey: matchesKey,
    queryFn: ({ pageParam }) => listMatches(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const items = matches.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(m) => m.matchId}
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
        renderItem={({ item }) => <MatchRow match={item} />}
        onEndReached={() => {
          if (matches.hasNextPage && !matches.isFetchingNextPage) void matches.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={matches.isRefetching}
            onRefresh={() => void matches.refetch()}
            tintColor={theme.colors.accent}
          />
        }
        ListEmptyComponent={
          matches.isPending ? (
            <ActivityIndicator />
          ) : matches.isError ? (
            <Notice message={describeError(matches.error)} />
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
        ListFooterComponent={matches.isFetchingNextPage ? <ActivityIndicator /> : undefined}
      />
    </Screen>
  );
}

function MatchRow({ match }: { match: MatchSummaryDto }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${match.user.displayName}, ${match.user.age}. Eşleşmeyi aç`}
      onPress={() => router.push({ pathname: '/match/[id]', params: { id: match.matchId } })}
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
        {match.user.photoUrl ? (
          <Image
            source={{ uri: match.user.photoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
      </View>
      <View style={styles.flex}>
        <Text variant="headline">
          {match.user.displayName}, {match.user.age}
        </Text>
        <Text variant="caption" color="textMuted">
          {formatDate(match.matchedAt)} tarihinde eşleştiniz
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden' },
});
