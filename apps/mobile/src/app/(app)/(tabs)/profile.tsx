import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { requestAccountDeletion } from '@/api/account';
import { listSessions, revokeSession } from '@/api/auth';
import { ApiError } from '@/api/client';
import { getDataExport, getVerification, requestDataExport } from '@/api/safety';
import { Button } from '@/design/components/button';
import { Notice } from '@/design/components/notice';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { describeUserAgent, formatDate, formatDateTime } from '@/features/account/format';
import { describeError } from '@/features/auth/error-message';
import { VerifiedBadge } from '@/features/discovery/profile-card';
import { NotificationSettingsSection } from '@/features/notifications/notification-settings';
import { usePhotos } from '@/features/photos/photo-manager';
import { labelOf, RELATIONSHIP_GOAL_OPTIONS } from '@/features/profile/labels';
import { useMyProfile } from '@/features/profile/queries';
import { dataExportKey, verificationKey } from '@/features/safety/query-keys';
import { clearLocalSession, signOut } from '@/features/session/session';
import { useMe } from '@/features/session/use-me';

const sessionsKey = ['sessions'] as const;

/**
 * Profil sekmesi: profil özeti ve düzenleme, hesap işlemleri.
 */
export default function ProfileTabScreen() {
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
        </View>

        <ProfileCard age={me.data?.age ?? null} />

        <Section title="Hesap">
          <Row label="Yaş" value={me.data?.age != null ? String(me.data.age) : '—'} />
          <Row label="Üyelik" value={me.data ? formatDate(me.data.createdAt) : '—'} />
        </Section>

        <VerificationSection />

        <Section title="Bildirimler">
          <NotificationSettingsSection />
        </Section>

        <DataExportSection />
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

const VERIFICATION_TEXT = {
  NONE: 'Selfie ile profilini doğrula; doğrulanmış profiller daha çok güven verir.',
  PENDING: "Selfie'n inceleniyor.",
  REJECTED: 'Önceki selfie onaylanmadı. Tekrar deneyebilirsin.',
  APPROVED: 'Profilin doğrulandı.',
} as const;

function VerificationSection() {
  const verification = useQuery({ queryKey: verificationKey, queryFn: getVerification });
  const data = verification.data;
  return (
    <Section title="Doğrulama">
      {verification.isError ? <Notice message={describeError(verification.error)} /> : null}
      {data ? (
        <View style={styles.inline}>
          {data.verified ? <VerifiedBadge size={22} /> : null}
          <Text style={styles.flex}>
            {data.verified ? VERIFICATION_TEXT.APPROVED : VERIFICATION_TEXT[data.status]}
          </Text>
        </View>
      ) : null}
      {data && !data.verified ? (
        <Button
          label={data.status === 'PENDING' ? 'Durumu gör' : 'Profilini doğrula'}
          variant="secondary"
          onPress={() => router.push('/verification')}
        />
      ) : null}
    </Section>
  );
}

function DataExportSection() {
  const queryClient = useQueryClient();
  const exportStatus = useQuery({
    queryKey: dataExportKey,
    queryFn: getDataExport,
    // Hazırlanırken birkaç saniyede bir yoklanır; hazır olunca durur.
    refetchInterval: (query) =>
      query.state.data?.status === 'REQUESTED' || query.state.data?.status === 'PROCESSING'
        ? 4000
        : false,
  });
  const request = useMutation({
    mutationFn: requestDataExport,
    onSuccess: (data) => queryClient.setQueryData(dataExportKey, data),
  });
  // İndirme adresi kısa ömürlü; açmadan hemen önce yenisi alınır.
  const download = useMutation({
    mutationFn: async () => {
      const latest = await getDataExport();
      if (!latest?.downloadUrl) {
        throw new ApiError(410, 'EXPORT_EXPIRED', 'Dosyanın süresi dolmuş, yeniden hazırla.');
      }
      await Linking.openURL(latest.downloadUrl);
    },
  });

  const data = exportStatus.data;
  const preparing = data?.status === 'REQUESTED' || data?.status === 'PROCESSING';
  const ready = data?.status === 'COMPLETED' && Boolean(data.downloadUrl);

  return (
    <Section title="Verilerin">
      <Text variant="body" color="textMuted">
        Profilin, fotoğrafların, tercihlerin, beğenilerin, gönderdiğin mesajlar ve onay kayıtların
        tek bir dosyada (JSON) hazırlanır. Dosya 7 gün saklanır.
      </Text>
      {preparing ? <Notice tone="info" message="Dosyan hazırlanıyor…" /> : null}
      {data?.status === 'FAILED' ? (
        <Notice message="Dosya hazırlanamadı. Tekrar deneyebilirsin." />
      ) : null}
      {ready && data?.expiresAt ? (
        <Text variant="caption" color="textMuted">
          Hazır · {formatDateTime(data.expiresAt)} tarihine kadar indirilebilir
        </Text>
      ) : null}
      {request.isError ? <Notice message={describeError(request.error)} /> : null}
      {download.isError ? <Notice message={describeError(download.error)} /> : null}
      {ready ? (
        <Button
          label="Dosyayı indir"
          loading={download.isPending}
          onPress={() => download.mutate()}
        />
      ) : null}
      <Button
        label={ready ? 'Yeniden hazırla' : 'Verilerimi indir'}
        variant={ready ? 'ghost' : 'secondary'}
        disabled={preparing}
        loading={request.isPending}
        onPress={() => request.mutate()}
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
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
