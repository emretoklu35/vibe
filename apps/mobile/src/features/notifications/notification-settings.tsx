import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { getNotificationSettings, setNotificationSettings } from '@/api/chat';
import { Button } from '@/design/components/button';
import { CheckboxRow } from '@/design/components/checkbox-row';
import { Notice } from '@/design/components/notice';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { describeError } from '@/features/auth/error-message';

import { pushPermissionGranted, type PushRegistration, registerForPush } from './push';

const settingsKey = ['notification-settings'] as const;

const OUTCOME_TEXT: Record<Exclude<PushRegistration, 'registered'>, string> = {
  denied: 'Bildirim izni kapalı. Telefonunun ayarlarından VIBE için bildirimleri açabilirsin.',
  unsupported: 'Bu cihazda push bildirimi desteklenmiyor.',
  failed: 'Bildirimler şu anda açılamadı, biraz sonra tekrar dene.',
};

/** Profil sekmesindeki bildirim bölümü: izin + tür bazında tercihler (sunucuda saklanır). */
export function NotificationSettingsSection() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: settingsKey, queryFn: getNotificationSettings });
  const permission = useQuery({ queryKey: ['push-permission'], queryFn: pushPermissionGranted });
  const [outcome, setOutcome] = useState<PushRegistration | null>(null);

  const save = useMutation({
    mutationFn: setNotificationSettings,
    onSuccess: (data) => queryClient.setQueryData(settingsKey, data),
  });
  const enable = useMutation({
    mutationFn: () => registerForPush({ ask: true }),
    onSuccess: (result) => {
      setOutcome(result);
      void permission.refetch();
    },
  });

  return (
    <View style={{ gap: theme.spacing.md }}>
      {Platform.OS === 'web' ? (
        <Text variant="caption" color="textMuted">
          {OUTCOME_TEXT.unsupported}
        </Text>
      ) : permission.data ? null : (
        <Button
          label="Bildirimlere izin ver"
          variant="secondary"
          loading={enable.isPending}
          onPress={() => enable.mutate()}
        />
      )}
      {outcome && outcome !== 'registered' ? (
        <Notice tone="info" message={OUTCOME_TEXT[outcome]} />
      ) : null}
      {settings.data ? (
        <>
          <CheckboxRow
            label="Yeni eşleşme"
            checked={settings.data.newMatch}
            onChange={(newMatch) => save.mutate({ ...settings.data!, newMatch })}
          />
          <CheckboxRow
            label="Yeni mesaj"
            checked={settings.data.newMessage}
            onChange={(newMessage) => save.mutate({ ...settings.data!, newMessage })}
          />
          <Text variant="caption" color="textMuted">
            Bildirimlerde mesaj içeriği ve kişi adı gösterilmez.
          </Text>
        </>
      ) : null}
      {settings.isError ? <Notice message={describeError(settings.error)} /> : null}
      {save.isError ? <Notice message={describeError(save.error)} /> : null}
    </View>
  );
}
