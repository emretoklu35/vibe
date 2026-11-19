import type { ProfileCardDto, ReportReason } from '@vibe/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { createReport } from '@/api/safety';
import { Button } from '@/design/components/button';
import { CheckboxRow } from '@/design/components/checkbox-row';
import { ChipGroup } from '@/design/components/chip';
import { Notice } from '@/design/components/notice';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { TextField } from '@/design/components/text-field';
import { useTheme } from '@/design/theme';
import { describeError } from '@/features/auth/error-message';
import { conversationsKey } from '@/features/chat/cache';
import { candidatesKey, matchesKey } from '@/features/discovery/query-keys';
import { parseTargetType, REPORT_REASONS, reportTitle } from '@/features/safety/report-reasons';

/**
 * Şikayet: neden + isteğe bağlı açıklama + "engelle". Kanıt (profil, fotoğraflar, mesaj ve bağlamı)
 * sunucuda şikayet anında kopyalanır; kişi profilini sonradan değiştirse de moderatör görür.
 */
export default function ReportScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    userId: string;
    targetType?: string;
    targetId?: string;
    name?: string;
  }>();
  const targetType = parseTargetType(params.targetType);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);

  const report = useMutation({
    mutationFn: () =>
      createReport({
        userId: params.userId,
        reason: reason!,
        targetType,
        ...(targetType === 'PROFILE' || !params.targetId ? {} : { targetId: params.targetId }),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        alsoBlock,
      }),
    onSuccess: async () => {
      // Şikayet edilen kişi keşfet destesinden hemen çıkar.
      queryClient.setQueryData<ProfileCardDto[]>(candidatesKey, (prev) =>
        prev?.filter((card) => card.userId !== params.userId),
      );
      if (alsoBlock) {
        await queryClient.invalidateQueries({ queryKey: matchesKey });
        await queryClient.invalidateQueries({ queryKey: conversationsKey });
      }
    },
  });

  if (report.isSuccess) {
    return (
      <Screen style={{ justifyContent: 'center', gap: theme.spacing.lg }}>
        <Text variant="title" align="center" accessibilityRole="header">
          Teşekkürler
        </Text>
        <Text align="center" color="textMuted">
          Şikayetin ekibimize ulaştı ve gizli tutulur; şikayet ettiğin kişiye kim olduğun söylenmez.
          {alsoBlock ? ' Bu kişiyi engelledin, birbirinizi artık görmeyeceksiniz.' : ''}
        </Text>
        {reason === 'VIOLENCE_THREAT' || reason === 'OFFLINE_BEHAVIOR' ? (
          <Notice
            tone="info"
            message="Kendini tehlikede hissediyorsan hemen 112'yi ara. Uygulamadaki şikayet acil yardımın yerini tutmaz."
          />
        ) : null}
        <Button
          label="Tamam"
          // Engellenen kişinin sohbet/eşleşme ekranına geri dönülmez.
          onPress={() => (alsoBlock ? router.dismissAll() : router.back())}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: theme.spacing.lg, gap: theme.spacing.xl }}
      >
        <Button label="‹ Vazgeç" variant="ghost" onPress={() => router.back()} />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title" accessibilityRole="header">
            Şikayet et
          </Text>
          <Text color="textMuted">
            {reportTitle(params.name, targetType)} neden şikayet ediyorsun?
          </Text>
        </View>

        <ChipGroup options={REPORT_REASONS} value={reason} onChange={setReason} />

        <TextField
          label="Ne oldu? (isteğe bağlı)"
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={1000}
          hint="Moderatörün durumu anlamasına yardımcı olur."
        />

        <CheckboxRow
          checked={alsoBlock}
          onChange={setAlsoBlock}
          label="Bu kişiyi engelle (eşleşmeniz biter, birbirinizi bir daha görmezsiniz)"
        />

        {report.isError ? <Notice message={describeError(report.error)} /> : null}
        <Button
          label="Şikayeti gönder"
          disabled={!reason}
          loading={report.isPending}
          onPress={() => report.mutate()}
        />
      </ScrollView>
    </Screen>
  );
}
