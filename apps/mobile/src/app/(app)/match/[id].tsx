import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { blockUser, getMatch, unmatch } from '@/api/discovery';
import { Button } from '@/design/components/button';
import { Notice } from '@/design/components/notice';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { formatDate } from '@/features/account/format';
import { describeError } from '@/features/auth/error-message';
import { CardDetails, CardHero } from '@/features/discovery/profile-card';
import { matchesKey, matchKey } from '@/features/discovery/query-keys';
import { LoadingView } from '@/features/session/status-views';

type Confirm = 'unmatch' | 'block' | null;

export default function MatchScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const match = useQuery({ queryKey: matchKey(id), queryFn: () => getMatch(id) });
  const [confirm, setConfirm] = useState<Confirm>(null);

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: matchesKey });
    router.back();
  };
  const end = useMutation({ mutationFn: () => unmatch(id), onSuccess: done });
  const block = useMutation({
    mutationFn: () => blockUser(match.data!.profile.userId),
    onSuccess: done,
  });

  if (match.isPending) return <LoadingView />;
  if (match.isError) {
    return (
      <Screen style={{ justifyContent: 'center', gap: theme.spacing.lg }}>
        <Notice message={describeError(match.error)} />
        <Button label="Geri" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const { profile, matchedAt } = match.data;
  const error = end.error ?? block.error;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingVertical: theme.spacing.lg, gap: theme.spacing.lg }}
      >
        <Button label="‹ Geri" variant="ghost" onPress={() => router.back()} />
        <CardHero card={profile} />
        <Text variant="caption" color="textMuted">
          {formatDate(matchedAt)} tarihinde eşleştiniz. Mesajlaşma bir sonraki güncellemeyle
          gelecek.
        </Text>
        <CardDetails card={profile} />

        {error ? <Notice message={describeError(error)} /> : null}
        {confirm ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Notice
              message={
                confirm === 'unmatch'
                  ? `${profile.displayName} ile eşleşmen bitsin mi? Bu geri alınamaz.`
                  : `${profile.displayName} engellensin mi? Eşleşmeniz biter ve birbirinizi bir daha görmezsiniz.`
              }
            />
            <Button
              label={confirm === 'unmatch' ? 'Evet, eşleşmeyi bitir' : 'Evet, engelle'}
              variant="secondary"
              loading={end.isPending || block.isPending}
              onPress={() => (confirm === 'unmatch' ? end.mutate() : block.mutate())}
            />
            <Button label="Vazgeç" variant="ghost" onPress={() => setConfirm(null)} />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label="Eşleşmeyi bitir"
              variant="secondary"
              onPress={() => setConfirm('unmatch')}
            />
            <Button label="Engelle" variant="ghost" onPress={() => setConfirm('block')} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
