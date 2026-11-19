import type { VerificationStatusDto } from '@vibe/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getVerification } from '@/api/safety';
import { Button } from '@/design/components/button';
import { Notice } from '@/design/components/notice';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { describeError } from '@/features/auth/error-message';
import { discoveryStatusKey } from '@/features/discovery/query-keys';
import { verificationKey } from '@/features/safety/query-keys';
import { type SelfieOutcome, takeAndSubmitSelfie } from '@/features/safety/selfie';

/** Selfie doğrulama: moderatör selfie'yi profil fotoğraflarıyla karşılaştırır, onaylanırsa rozet gelir. */
export default function VerificationScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: verificationKey, queryFn: getVerification });
  const [outcome, setOutcome] = useState<SelfieOutcome['kind'] | null>(null);

  const selfie = useMutation({
    mutationFn: takeAndSubmitSelfie,
    onSuccess: (result) => {
      setOutcome(result.kind);
      if (result.kind === 'submitted') {
        queryClient.setQueryData<VerificationStatusDto>(verificationKey, result.status);
        void queryClient.invalidateQueries({ queryKey: discoveryStatusKey });
      }
    },
  });

  const data = status.data;
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingVertical: theme.spacing.lg, gap: theme.spacing.xl }}
      >
        <Button label="‹ Geri" variant="ghost" onPress={() => router.back()} />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title" accessibilityRole="header">
            Profilini doğrula
          </Text>
          <Text color="textMuted">
            Bir selfie çek; ekibimiz profil fotoğraflarındaki kişinin sen olduğunu kontrol etsin.
            Onaylanınca profilinde doğrulanmış rozeti görünür.
          </Text>
        </View>

        {status.isPending ? <Text color="textMuted">Yükleniyor…</Text> : null}
        {status.isError ? <Notice message={describeError(status.error)} /> : null}

        {data?.verified ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={28} color={theme.colors.success} />
            <Text variant="headline">Profilin doğrulandı</Text>
          </View>
        ) : null}

        {data && !data.verified && data.status === 'PENDING' ? (
          <Notice
            tone="info"
            message="Selfie'n inceleniyor. Sonuç genellikle 24 saat içinde belli olur."
          />
        ) : null}

        {data && !data.verified && data.status !== 'PENDING' ? (
          <View style={{ gap: theme.spacing.md }}>
            {data.required ? (
              <Notice
                tone="info"
                message="Güvenlik ekibimiz senden doğrulama istedi. Doğrulayana kadar profilin keşfette görünmez."
              />
            ) : null}
            {data.status === 'REJECTED' ? (
              <Notice
                message={`Önceki selfie onaylanmadı${data.note ? `: ${data.note}` : '.'} Tekrar deneyebilirsin.`}
              />
            ) : null}
            <Text variant="label">İyi bir selfie için</Text>
            <Text color="textMuted">
              • Yüzün tamamen görünsün; güneş gözlüğü, maske veya filtre olmasın.{'\n'}• Aydınlık
              bir yerde ve yalnız çek.{'\n'}• Profil fotoğraflarında sen olmalısın.
            </Text>
            <Text variant="caption" color="textMuted">
              Selfie yalnızca doğrulama için kullanılır, profilinde gösterilmez ve karardan 30 gün
              sonra silinir.
            </Text>
            {outcome === 'denied' ? (
              <>
                <Notice
                  tone="info"
                  message="Kamera izni kapalı. Telefonunun ayarlarından VIBE için kamera iznini açabilirsin."
                />
                <Button
                  label="Ayarları aç"
                  variant="ghost"
                  onPress={() => void Linking.openSettings()}
                />
              </>
            ) : null}
            {selfie.isError ? <Notice message={describeError(selfie.error)} /> : null}
            <Button label="Selfie çek" loading={selfie.isPending} onPress={() => selfie.mutate()} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
