import type { Gender, PreferenceDto, RelationshipGoal } from '@vibe/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { getAppConfig, recordConsents } from '@/api/account';
import { setPreferences } from '@/api/profile';
import { Button } from '@/design/components/button';
import { CheckboxRow } from '@/design/components/checkbox-row';
import { ChipGroup } from '@/design/components/chip';
import { FormScreen } from '@/design/components/form-screen';
import { Notice } from '@/design/components/notice';
import { Text } from '@/design/components/text';
import { TextField } from '@/design/components/text-field';
import { useTheme } from '@/design/theme';
import { describeError } from '@/features/auth/error-message';
import {
  DISTANCE_OPTIONS,
  GENDER_OPTIONS,
  RELATIONSHIP_GOAL_OPTIONS,
} from '@/features/profile/labels';

const ORIENTATION = 'SPECIAL_CATEGORY_ORIENTATION';
export const preferencesQueryKey = ['preferences'] as const;
export const consentsQueryKey = ['consents'] as const;

type Props = {
  initial: PreferenceDto | null;
  /** Kullanıcının bu belgeye güncel rızası var mı (GET /privacy/consents). */
  orientationConsentGiven: boolean;
  title: string;
  subtitle?: string;
  step?: string;
  submitLabel: string;
  onSaved: () => void;
};

/**
 * Keşfet tercihleri. "Kimi arıyorsun?" özel nitelikli veridir (K7): ancak açık rıza kutusu
 * işaretliyse seçilebilir ve kaydedilir. Rıza verilmezse tercih boş kaydedilir, keşfet kapalı kalır.
 */
export function PreferencesForm({
  initial,
  orientationConsentGiven,
  title,
  subtitle,
  step,
  submitLabel,
  onSaved,
}: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['app-config'], queryFn: getAppConfig });
  const [consent, setConsent] = useState(orientationConsentGiven);
  const [seeking, setSeeking] = useState<Gender[]>(initial?.seekingGenders ?? []);
  const [goals, setGoals] = useState<RelationshipGoal[]>(initial?.relationshipGoals ?? []);
  const [minAge, setMinAge] = useState(String(initial?.minAge ?? 18));
  const [maxAge, setMaxAge] = useState(String(initial?.maxAge ?? 60));
  const [distance, setDistance] = useState<number | null>(initial?.maxDistanceKm ?? 50);

  const min = Number(minAge);
  const max = Number(maxAge);
  const ageError =
    !Number.isInteger(min) || !Number.isInteger(max) || min < 18 || max > 99 || min > max
      ? 'Yaş aralığı 18–99 arasında olmalı ve en küçük yaş en büyükten büyük olmamalı'
      : undefined;

  const save = useMutation({
    mutationFn: async () => {
      const doc = config.data?.legalDocuments.find((d) => d.type === ORIENTATION);
      if (!doc) throw new Error('Rıza metni yüklenemedi');
      // Rıza durumu değiştiyse önce kaydedilir (geri alma sunucuda tercihi de temizler).
      if (consent !== orientationConsentGiven) {
        await recordConsents([{ type: ORIENTATION, granted: consent, textVersion: doc.version }]);
      }
      await setPreferences({
        minAge: min,
        maxAge: max,
        maxDistanceKm: distance ?? 50,
        seekingGenders: consent ? seeking : [],
        relationshipGoals: goals,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: preferencesQueryKey }),
        queryClient.invalidateQueries({ queryKey: consentsQueryKey }),
      ]);
      onSaved();
    },
  });

  const needsSeeking = consent && seeking.length === 0;

  return (
    <FormScreen
      title={title}
      subtitle={subtitle}
      step={step}
      footer={
        <>
          {save.isError ? <Notice message={describeError(save.error)} /> : null}
          {!consent ? (
            <Notice
              tone="info"
              message="Rıza vermeden devam edersen profilin hazır olur, ancak keşfet ve eşleşme kapalı kalır. İstediğin zaman buradan açabilirsin."
            />
          ) : null}
          <Button
            label={submitLabel}
            loading={save.isPending}
            disabled={Boolean(ageError) || needsSeeking || config.isPending}
            onPress={() => save.mutate()}
          />
        </>
      }
    >
      <View style={{ gap: theme.spacing.xl }}>
        <CheckboxRow
          label="Kimi aradığıma dair bilginin keşfet ve eşleşme için işlenmesine açık rıza veriyorum"
          checked={consent}
          onChange={setConsent}
        >
          <Button
            label="Açık rıza metnini oku"
            variant="ghost"
            onPress={() =>
              router.push({ pathname: '/legal/[type]', params: { type: ORIENTATION } })
            }
          />
        </CheckboxRow>

        <View style={{ gap: theme.spacing.xs }}>
          <ChipGroup
            label="Kimi arıyorsun?"
            multiple
            options={GENDER_OPTIONS}
            value={consent ? seeking : []}
            onChange={setSeeking}
            disabled={!consent}
          />
          {needsSeeking ? (
            <Text variant="caption" color="danger">
              En az birini seç
            </Text>
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color="textMuted">
            Yaş aralığı
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="En az"
                keyboardType="number-pad"
                maxLength={2}
                value={minAge}
                onChangeText={(t) => setMinAge(t.replace(/\D/g, ''))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="En çok"
                keyboardType="number-pad"
                maxLength={2}
                value={maxAge}
                onChangeText={(t) => setMaxAge(t.replace(/\D/g, ''))}
              />
            </View>
          </View>
          {ageError ? (
            <Text variant="caption" color="danger">
              {ageError}
            </Text>
          ) : null}
        </View>

        <ChipGroup
          label="En fazla uzaklık"
          options={DISTANCE_OPTIONS}
          value={distance}
          onChange={setDistance}
        />

        <ChipGroup
          label="İlişki beklentisi (isteğe bağlı)"
          multiple
          options={RELATIONSHIP_GOAL_OPTIONS}
          value={goals}
          onChange={setGoals}
        />
      </View>
    </FormScreen>
  );
}
