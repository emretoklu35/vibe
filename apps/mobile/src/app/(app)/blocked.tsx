import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';

import { listBlocks, unblockUser } from '@/api/discovery';
import { Button } from '@/design/components/button';
import { FormScreen } from '@/design/components/form-screen';
import { Notice } from '@/design/components/notice';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { formatDate } from '@/features/account/format';
import { describeError } from '@/features/auth/error-message';
import { blocksKey } from '@/features/discovery/query-keys';

export default function BlockedScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const blocks = useQuery({ queryKey: blocksKey, queryFn: listBlocks });
  const unblock = useMutation({
    mutationFn: unblockUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blocksKey }),
  });

  return (
    <FormScreen
      title="Engellenenler"
      subtitle="Engeli kaldırırsan birbirinizi keşfette yeniden görebilirsiniz. Bitmiş eşleşmeler geri gelmez."
      footer={<Button label="Tamam" variant="secondary" onPress={() => router.back()} />}
    >
      <View style={{ gap: theme.spacing.md }}>
        {blocks.isError ? <Notice message={describeError(blocks.error)} /> : null}
        {unblock.isError ? <Notice message={describeError(unblock.error)} /> : null}
        {blocks.data?.length === 0 ? <Text color="textMuted">Kimseyi engellemedin.</Text> : null}
        {blocks.data?.map((b) => (
          <View
            key={b.userId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="label">{b.displayName ?? 'Silinmiş hesap'}</Text>
              <Text variant="caption" color="textMuted">
                {formatDate(b.blockedAt)}
              </Text>
            </View>
            <Button
              label="Engeli kaldır"
              variant="ghost"
              loading={unblock.isPending && unblock.variables === b.userId}
              onPress={() => unblock.mutate(b.userId)}
            />
          </View>
        ))}
      </View>
    </FormScreen>
  );
}
