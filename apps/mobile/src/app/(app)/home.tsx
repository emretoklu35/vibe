import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
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
import { usePhotos } from '@/features/photos/photo-manager';
import { labelOf, RELATIONSHIP_GOAL_OPTIONS } from '@/features/profile/labels';
import { useMyProfile } from '@/features/profile/queries';
import { clearLocalSession, signOut } from '@/features/session/session';
import { useMe } from '@/features/session/use-me';

const sessionsKey = ['sessions'] as const;

/**
 * Onboarding sonrası ana ekran: profil özeti ve düzenleme, hesap işlemleri.
 * Keşfet ve eşleşmeler Faz 4'te sekmeli yapıya geçecek.
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
            Profilin
          </Text>
          <Text variant="body" color="textMuted">
            Keşfet ve eşleşmeler bir sonraki güncellemeyle gelecek.
          </Text>
        </View>

        <ProfileCard age={me.data?.age ?? null} />

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

function ProfileCard({ age }: { age: number | null }) {
  const theme = useTheme();
  const profile = useMyProfile();
  const photos = usePhotos();
  const primary = photos.data?.find((p) => p.position === 0);
  const p = profile.data?.profile;

  return (
    <Section title="Profil">
      <View style={styles.profileRow}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radii.md },
          ]}
        >
          {primary?.url ? (
            <Image
              source={{ uri: primary.url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel="Ana fotoğrafın"
            />
          ) : null}
        </View>
        <View style={styles.flex}>
          <Text variant="headline">
            {p ? `${p.displayName}${age != null ? `, ${age}` : ''}` : '—'}
          </Text>
          {p?.cityName ? <Text color="textMuted">{p.cityName}</Text> : null}
          {p?.relationshipGoal ? (
            <Text variant="caption" color="accent">
              {labelOf(RELATIONSHIP_GOAL_OPTIONS, p.relationshipGoal)}
            </Text>
          ) : null}
          {profile.data && profile.data.interests.length > 0 ? (
            <Text variant="caption" color="textMuted" numberOfLines={2}>
              {profile.data.interests.map((i) => i.label).join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>
      <Button
        label="Profili düzenle"
        variant="secondary"
        onPress={() => router.push('/profile-edit')}
      />
      <Button label="Fotoğraflar" variant="ghost" onPress={() => router.push('/photos')} />
      <Button
        label="Keşfet tercihleri"
        variant="ghost"
        onPress={() => router.push('/preferences')}
      />
    </Section>
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
  flex: { flex: 1, gap: 2 },
  profileRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  avatar: { width: 84, height: 105, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
