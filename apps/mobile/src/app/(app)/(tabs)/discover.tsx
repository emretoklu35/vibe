import type { DiscoveryRequirement, ProfileCardDto } from '@vibe/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { blockUser, getCandidates, getDiscoveryStatus, likeUser, passUser } from '@/api/discovery';
import { Button } from '@/design/components/button';
import { Notice } from '@/design/components/notice';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { describeError } from '@/features/auth/error-message';
import { conversationsKey } from '@/features/chat/cache';
import { CardDetails, CardHero } from '@/features/discovery/profile-card';
import { candidatesKey, discoveryStatusKey, matchesKey } from '@/features/discovery/query-keys';
import {
  LOCATION_REFRESH_MS,
  type LocationOutcome,
  shareLocation,
} from '@/features/location/location-sync';
import { useMyProfile } from '@/features/profile/queries';

export default function DiscoverScreen() {
  const status = useQuery({ queryKey: discoveryStatusKey, queryFn: getDiscoveryStatus });
  useSilentLocationRefresh(status.data?.ready ?? false);

  return (
    <Screen>
      {status.isPending ? (
        <Centered>
          <ActivityIndicator />
        </Centered>
      ) : status.isError ? (
        <Centered>
          <Notice message={describeError(status.error)} />
          <Button label="Tekrar dene" variant="secondary" onPress={() => void status.refetch()} />
        </Centered>
      ) : status.data.ready ? (
        <CandidateDeck />
      ) : (
        <Checklist missing={status.data.missing} />
      )}
    </Screen>
  );
}

/** Konum izni zaten verilmişse ve konum 6 saatten eskiyse sessizce güncellenir (izin istenmez). */
function useSilentLocationRefresh(enabled: boolean) {
  const profile = useMyProfile();
  const updatedAt = profile.data?.profile?.locationUpdatedAt;
  useFocusEffect(
    useCallback(() => {
      if (!enabled || !updatedAt) return;
      if (Date.now() - new Date(updatedAt).getTime() < LOCATION_REFRESH_MS) return;
      void shareLocation({ ask: false }).then(() => profile.refetch());
    }, [enabled, updatedAt, profile]),
  );
}

const REQUIREMENT_TEXT: Record<
  DiscoveryRequirement,
  { title: string; action?: string; route?: string }
> = {
  PROFILE: { title: 'Profilini oluştur', action: 'Profili düzenle', route: '/profile-edit' },
  APPROVED_PHOTO: {
    title: 'En az bir onaylı fotoğrafın olmalı. Fotoğrafların kontrol ediliyorsa biraz bekle.',
    action: 'Fotoğraflar',
    route: '/photos',
  },
  LOCATION: { title: 'Yakınındaki kişileri gösterebilmemiz için yaklaşık konumunu paylaş.' },
  ORIENTATION_CONSENT: {
    title: 'Kimi aradığını işleyebilmemiz için açık rızan gerekiyor.',
    action: 'Keşfet tercihleri',
    route: '/preferences',
  },
  SEEKING_GENDERS: {
    title: 'Kimi aradığını seç.',
    action: 'Keşfet tercihleri',
    route: '/preferences',
  },
  VERIFICATION: {
    title: 'Güvenlik ekibimiz senden profilini doğrulamanı istedi. Kısa bir selfie çekmen yeterli.',
    action: 'Profilini doğrula',
    route: '/verification',
  },
  UNDER_REVIEW: {
    title:
      'Hesabın şu anda güvenlik incelemesinde. İnceleme bitene kadar keşfette görünmezsin; eşleşmelerinle sohbet etmeye devam edebilirsin.',
  },
  VISIBLE: {
    title: 'Profilin keşfette gizli. Görünür yaparsan keşfet açılır.',
    action: 'Profili düzenle',
    route: '/profile-edit',
  },
};

function Checklist({ missing }: { missing: DiscoveryRequirement[] }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<LocationOutcome | null>(null);
  const location = useMutation({
    mutationFn: () => shareLocation({ ask: true }),
    onSuccess: async (result) => {
      setOutcome(result);
      if (result === 'sent') await queryClient.invalidateQueries({ queryKey: discoveryStatusKey });
    },
  });

  return (
    <ScrollView
      contentContainerStyle={{ paddingVertical: theme.spacing.xxl, gap: theme.spacing.xl }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title" accessibilityRole="header">
          Keşfete az kaldı
        </Text>
        <Text color="textMuted">Keşfeti açmak için şunları tamamla:</Text>
      </View>
      {missing.map((item) => {
        const text = REQUIREMENT_TEXT[item];
        return (
          <View
            key={item}
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.md,
              padding: theme.spacing.lg,
              gap: theme.spacing.md,
            }}
          >
            <Text>{text.title}</Text>
            {item === 'LOCATION' ? (
              <>
                <Button
                  label="Konumumu paylaş"
                  loading={location.isPending}
                  onPress={() => location.mutate()}
                />
                {outcome === 'denied' ? (
                  <>
                    <Notice
                      tone="info"
                      message="Konum izni kapalı. Telefonunun ayarlarından VIBE için konum iznini açabilirsin."
                    />
                    <Button
                      label="Ayarları aç"
                      variant="ghost"
                      onPress={() => void Linking.openSettings()}
                    />
                  </>
                ) : null}
                {outcome === 'unavailable' ? (
                  <Notice message="Konum alınamadı, biraz sonra tekrar dene." />
                ) : null}
                {location.isError ? <Notice message={describeError(location.error)} /> : null}
              </>
            ) : text.route ? (
              <Button
                label={text.action ?? 'Düzenle'}
                variant="secondary"
                onPress={() => router.push(text.route as never)}
              />
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

function CandidateDeck() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const candidates = useQuery({ queryKey: candidatesKey, queryFn: () => getCandidates(10) });
  const [matchedWith, setMatchedWith] = useState<{
    card: ProfileCardDto;
    matchId: string;
    conversationId: string | null;
  } | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const current = candidates.data?.[0];

  // Sıradaki kart sayısı azalınca arka planda yenisi istenir.
  const advance = useCallback(() => {
    setConfirmBlock(false);
    queryClient.setQueryData<ProfileCardDto[]>(candidatesKey, (prev) => prev?.slice(1));
    const remaining = (queryClient.getQueryData<ProfileCardDto[]>(candidatesKey) ?? []).length;
    if (remaining <= 2) void queryClient.invalidateQueries({ queryKey: candidatesKey });
  }, [queryClient]);

  const like = useMutation({
    mutationFn: (card: ProfileCardDto) => likeUser(card.userId),
    onSuccess: (result, card) => {
      if (result.matched && result.matchId) {
        setMatchedWith({ card, matchId: result.matchId, conversationId: result.conversationId });
        void queryClient.invalidateQueries({ queryKey: matchesKey });
        void queryClient.invalidateQueries({ queryKey: conversationsKey });
      }
      advance();
    },
  });
  const pass = useMutation({
    mutationFn: (card: ProfileCardDto) => passUser(card.userId),
    onSuccess: advance,
  });
  const block = useMutation({
    mutationFn: (card: ProfileCardDto) => blockUser(card.userId),
    onSuccess: advance,
  });
  const busy = like.isPending || pass.isPending || block.isPending;
  const error = like.error ?? pass.error ?? block.error;

  if (matchedWith) {
    return (
      <Centered>
        <Text variant="display" align="center" color="accent" style={{ letterSpacing: 1 }}>
          Eşleştiniz!
        </Text>
        <Text variant="headline" align="center">
          {matchedWith.card.displayName} de seni beğendi.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: theme.spacing.md }}>
          <Button
            label="Mesaj gönder"
            onPress={() => {
              const { matchId, conversationId } = matchedWith;
              setMatchedWith(null);
              if (conversationId)
                router.push({ pathname: '/chat/[id]', params: { id: conversationId } });
              else router.push({ pathname: '/match/[id]', params: { id: matchId } });
            }}
          />
          <Button
            label="Keşfetmeye devam et"
            variant="ghost"
            onPress={() => setMatchedWith(null)}
          />
        </View>
      </Centered>
    );
  }

  if (candidates.isPending) {
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  }
  if (candidates.isError) {
    return (
      <Centered>
        <Notice message={describeError(candidates.error)} />
        <Button label="Tekrar dene" variant="secondary" onPress={() => void candidates.refetch()} />
      </Centered>
    );
  }
  if (!current) {
    return (
      <Centered>
        <Text variant="headline" align="center">
          Şimdilik bu kadar
        </Text>
        <Text color="textMuted" align="center">
          Tercihlerine uyan herkesi gördün. Yeni kişiler katıldıkça burada göreceksin; mesafe veya
          yaş aralığını genişletmeyi de deneyebilirsin.
        </Text>
        <Button
          label="Keşfet tercihleri"
          variant="secondary"
          onPress={() => router.push('/preferences')}
        />
        <Button
          label="Yenile"
          variant="ghost"
          loading={candidates.isFetching}
          onPress={() => void candidates.refetch()}
        />
      </Centered>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        key={current.userId}
        style={styles.flex}
        contentContainerStyle={{
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <CardHero card={current} />
        <CardDetails card={current} />
        {confirmBlock ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Notice
              message={`${current.displayName} engellensin mi? Birbirinizi bir daha görmezsiniz.`}
            />
            <Button
              label="Evet, engelle"
              variant="secondary"
              loading={block.isPending}
              onPress={() => block.mutate(current)}
            />
            <Button label="Vazgeç" variant="ghost" onPress={() => setConfirmBlock(false)} />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.xs }}>
            <Button
              label="Şikayet et"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: '/report',
                  params: { userId: current.userId, name: current.displayName },
                })
              }
            />
            <Button label="Engelle" variant="ghost" onPress={() => setConfirmBlock(true)} />
          </View>
        )}
      </ScrollView>
      {error ? <Notice message={describeError(error)} /> : null}
      <View style={[styles.actions, { paddingVertical: theme.spacing.md }]}>
        <RoundAction
          icon="close"
          label="Geç"
          disabled={busy}
          onPress={() => pass.mutate(current)}
        />
        <RoundAction
          icon="heart"
          label="Beğen"
          primary
          disabled={busy}
          onPress={() => like.mutate(current)}
        />
      </View>
    </View>
  );
}

function RoundAction({
  icon,
  label,
  primary,
  disabled,
  onPress,
}: {
  icon: 'close' | 'heart';
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        {
          backgroundColor: primary ? theme.colors.accent : theme.colors.surface,
          borderColor: primary ? theme.colors.accent : theme.colors.border,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <Ionicons name={icon} size={30} color={primary ? theme.colors.onAccent : theme.colors.text} />
    </Pressable>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.centered, { gap: theme.spacing.lg }]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  round: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
