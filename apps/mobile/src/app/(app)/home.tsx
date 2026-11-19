import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { requestAccountDeletion } from '@/api/account';
import { listSessions, revokeSession } from '@/api/auth';
import { Button } from '@/design/components/button';
import { Notice } from '@/design/components/notice';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { describeUserAgent, formatDate, formatDateTime } from '@/features/account/format';
import { describeError } from '@/features/auth/error-message';
import { clearLocalSession, signOut } from '@/features/session/session';
import { useMe } from '@/features/session/use-me';

const sessionsKey = ['sessions'] as const;

/**
 * Onboarding sonrası ilk ekran. Profil ve keşfet sonraki fazlarda eklenecek;
 * şimdilik hesabın gerçek işlevleri burada: oturumlar, çıkış, hesap silme.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const me = useMe();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingVertical: theme.spacing.xxl, gap: theme.spacing.xl }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title" accessibilityRole="header">
            Hoş geldin
          </Text>
          <Text variant="body" color="textMuted">
            Hesabın hazır. Profil oluşturma ve keşfet bir sonraki güncellemeyle gelecek.
          </Text>
        </View>

        <Section title="Hesap">
          <Row label="Yaş" value={me.data?.age != null ? String(me.data.age) : '—'} />
          <Row label="Üyelik" value={me.data ? formatDate(me.data.createdAt) : '—'} />
        </Section>

        <SessionsSection />
        <DangerZone />
      </ScrollView>
    </Screen>
  );
}

function SessionsSection() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: sessionsKey, queryFn: listSessions });
  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  });

  return (
    <Section title="Açık oturumlar">
      {sessions.isPending ? <Text color="textMuted">Yükleniyor…</Text> : null}
      {sessions.isError ? <Notice message={describeError(sessions.error)} /> : null}
      {revoke.isError ? <Notice message={describeError(revoke.error)} /> : null}
      {sessions.data?.map((session) => (
        <View
          key={session.id}
          style={[
            styles.sessionRow,
            { borderColor: theme.colors.border, paddingVertical: theme.spacing.md },
          ]}
        >
          <View style={styles.flex}>
            <Text variant="label">
              {describeUserAgent(session.userAgent)}
              {session.current ? '  ·  bu cihaz' : ''}
            </Text>
            <Text variant="caption" color="textMuted">
              Son kullanım: {formatDateTime(session.lastUsedAt)}
            </Text>
          </View>
          {session.current ? null : (
            <Button
              label="Kapat"
              variant="ghost"
              loading={revoke.isPending && revoke.variables === session.id}
              onPress={() => revoke.mutate(session.id)}
            />
          )}
        </View>
      ))}
      <Button label="Çıkış yap" variant="secondary" onPress={() => void signOut()} />
    </Section>
  );
}

function DangerZone() {
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: requestAccountDeletion,
    // Sunucu tüm oturumları kapattı; yerel oturum da kapanır.
    onSuccess: (info) =>
      clearLocalSession(
        `Hesabın ${formatDate(info.scheduledFor)} tarihinde kalıcı olarak silinecek. O zamana kadar giriş yaparak geri alabilirsin.`,
      ),
  });

  return (
    <Section title="Hesabı sil">
      <Text variant="body" color="textMuted">
        Hesabın hemen gizlenir ve 30 gün sonra tüm verilerinle birlikte kalıcı olarak silinir. Bu
        süre içinde giriş yaparak vazgeçebilirsin.
      </Text>
      {remove.isError ? <Notice message={describeError(remove.error)} /> : null}
      {confirming ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Notice message="Emin misin? Tüm oturumların kapanacak." />
          <Button
            label="Evet, hesabımı sil"
            loading={remove.isPending}
            onPress={() => remove.mutate()}
          />
          <Button label="Vazgeç" variant="ghost" onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <Button label="Hesabımı sil" variant="secondary" onPress={() => setConfirming(true)} />
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.lg,
        padding: theme.spacing.xl,
        gap: theme.spacing.md,
      }}
    >
      <Text variant="caption" color="textMuted">
        {title.toLocaleUpperCase('tr-TR')}
      </Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text color="textMuted">{label}</Text>
      <Text variant="label">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
