import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { restoreAccount } from '@/api/account';
import { Button } from '@/design/components/button';
import { Notice } from '@/design/components/notice';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { formatDate } from '@/features/account/format';
import { describeError } from '@/features/auth/error-message';
import { signOut } from '@/features/session/session';
import { meQueryKey, useMe } from '@/features/session/use-me';

export default function DeletionPendingScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const me = useMe();
  const restore = useMutation({
    mutationFn: restoreAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meQueryKey }),
  });
  const scheduledFor = me.data?.deletion?.scheduledFor;

  return (
    <Screen style={styles.screen}>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="title" accessibilityRole="header">
          Hesabın silinmek üzere
        </Text>
        <Text variant="body" color="textMuted">
          {scheduledFor
            ? `${formatDate(scheduledFor)} tarihinde hesabın ve tüm verilerin kalıcı olarak silinecek.`
            : 'Hesabın kalıcı olarak silinmek üzere.'}{' '}
          Fikrini değiştirdiysen şimdi geri alabilirsin.
        </Text>
      </View>
      <View style={{ gap: theme.spacing.md }}>
        {restore.isError ? <Notice message={describeError(restore.error)} /> : null}
        <Button
          label="Hesabımı geri al"
          loading={restore.isPending}
          onPress={() => restore.mutate()}
        />
        <Button label="Çıkış yap" variant="ghost" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between', paddingVertical: 48 },
});
