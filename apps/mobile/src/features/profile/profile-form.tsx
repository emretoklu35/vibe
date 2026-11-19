import type { Gender, MyProfileDto, UpsertProfileDto } from '@vibe/api-contract';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { listInterests, setInterests, upsertProfile } from '@/api/profile';
import { Button } from '@/design/components/button';
import { CheckboxRow } from '@/design/components/checkbox-row';
import { FormScreen } from '@/design/components/form-screen';
import { ChipGroup } from '@/design/components/chip';
import { Notice } from '@/design/components/notice';
import { Text } from '@/design/components/text';
import { TextField } from '@/design/components/text-field';
import { useTheme } from '@/design/theme';
import { describeError } from '@/features/auth/error-message';
import { applyServerFieldErrors } from '@/features/auth/server-field-errors';

import {
  COMMUNICATION_STYLE_OPTIONS,
  FREQUENCY_OPTIONS,
  GENDER_OPTIONS,
  RELATIONSHIP_GOAL_OPTIONS,
} from './labels';

const MAX_INTERESTS = 10;

const schema = z.object({
  displayName: z.string().trim().min(1, 'Adını yaz').max(40, 'En fazla 40 karakter'),
  gender: z
    .string()
    .nullable()
    .refine((v) => v !== null, 'Birini seç'),
  relationshipGoal: z.string().nullable(),
  bio: z.string().max(500, 'En fazla 500 karakter'),
  jobTitle: z.string().max(60, 'En fazla 60 karakter'),
  heightCm: z.string().refine((v) => v === '' || /^\d{3}$/.test(v), 'Boyu cm olarak yaz (ör. 172)'),
  cityName: z.string().max(80, 'En fazla 80 karakter'),
  smoking: z.string().nullable(),
  drinking: z.string().nullable(),
  exercise: z.string().nullable(),
  wantsChildren: z.enum(['yes', 'no']).nullable(),
  communicationStyle: z.string().nullable(),
  isDiscoverable: z.boolean(),
  interestIds: z.array(z.number()).max(MAX_INTERESTS),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const SERVER_FIELDS = ['displayName', 'bio', 'jobTitle', 'heightCm', 'cityName'] as const;

function toForm(data: MyProfileDto | undefined): FormInput {
  const p = data?.profile;
  return {
    displayName: p?.displayName ?? '',
    gender: p?.gender ?? null,
    relationshipGoal: p?.relationshipGoal ?? null,
    bio: p?.bio ?? '',
    jobTitle: p?.jobTitle ?? '',
    heightCm: p?.heightCm ? String(p.heightCm) : '',
    cityName: p?.cityName ?? '',
    smoking: p?.smoking ?? null,
    drinking: p?.drinking ?? null,
    exercise: p?.exercise ?? null,
    wantsChildren: p?.wantsChildren == null ? null : p.wantsChildren ? 'yes' : 'no',
    communicationStyle: p?.communicationStyle ?? null,
    isDiscoverable: p?.isDiscoverable ?? true,
    interestIds: data?.interests.map((i) => i.id) ?? [],
  };
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

function toDto(v: FormValues): UpsertProfileDto {
  return {
    displayName: v.displayName.trim(),
    gender: v.gender as Gender,
    relationshipGoal: v.relationshipGoal as UpsertProfileDto['relationshipGoal'],
    bio: orNull(v.bio),
    jobTitle: orNull(v.jobTitle),
    heightCm: v.heightCm ? Number(v.heightCm) : null,
    cityName: orNull(v.cityName),
    smoking: v.smoking as UpsertProfileDto['smoking'],
    drinking: v.drinking as UpsertProfileDto['drinking'],
    exercise: v.exercise as UpsertProfileDto['exercise'],
    wantsChildren: v.wantsChildren === null ? null : v.wantsChildren === 'yes',
    communicationStyle: v.communicationStyle as UpsertProfileDto['communicationStyle'],
    isDiscoverable: v.isDiscoverable,
  };
}

type ProfileFormProps = {
  /** onboarding: yalnızca ad, cinsiyet ve ilişki beklentisi. full: tüm alanlar + ilgi alanları. */
  variant: 'onboarding' | 'full';
  initial?: MyProfileDto;
  submitLabel: string;
  onSaved: (profile: MyProfileDto) => void;
  title: string;
  subtitle?: string;
  step?: string;
};

export function ProfileForm({
  variant,
  initial,
  submitLabel,
  onSaved,
  title,
  subtitle,
  step,
}: ProfileFormProps) {
  const theme = useTheme();
  const full = variant === 'full';
  const interests = useQuery({
    queryKey: ['interests'],
    queryFn: listInterests,
    enabled: full,
    staleTime: Infinity,
  });
  const { control, handleSubmit, formState, setError } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toForm(initial),
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const saved = await upsertProfile(toDto(values));
      if (!full) return saved;
      const before = new Set(initial?.interests.map((i) => i.id));
      const changed =
        before.size !== values.interestIds.length ||
        values.interestIds.some((id) => !before.has(id));
      return changed ? setInterests(values.interestIds) : saved;
    },
    onSuccess: onSaved,
    onError: (error) => applyServerFieldErrors(error, setError, SERVER_FIELDS),
  });

  const submit = handleSubmit((values) => save.mutate(values));
  const showGenericError =
    save.isError && !Object.values(formState.errors).some((e) => e?.type === 'server');

  const fields = (
    <View style={{ gap: theme.spacing.xl }}>
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label="Adın"
            placeholder="Profilinde görünecek ad"
            autoCapitalize="words"
            autoComplete="given-name"
            maxLength={40}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.displayName?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="gender"
        render={({ field }) => (
          <View style={{ gap: theme.spacing.xs }}>
            <ChipGroup
              label="Cinsiyetin"
              options={GENDER_OPTIONS}
              value={field.value as Gender | null}
              onChange={field.onChange}
            />
            {formState.errors.gender ? (
              <Text variant="caption" color="danger">
                {formState.errors.gender.message}
              </Text>
            ) : null}
          </View>
        )}
      />
      <Controller
        control={control}
        name="relationshipGoal"
        render={({ field }) => (
          <ChipGroup
            label="Ne arıyorsun? (isteğe bağlı)"
            options={RELATIONSHIP_GOAL_OPTIONS}
            value={field.value as (typeof RELATIONSHIP_GOAL_OPTIONS)[number]['value'] | null}
            onChange={field.onChange}
            allowClear
          />
        )}
      />

      {full ? (
        <>
          <Controller
            control={control}
            name="bio"
            render={({ field }) => (
              <TextField
                label="Hakkında"
                placeholder="Kendini birkaç cümleyle anlat"
                multiline
                maxLength={500}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={formState.errors.bio?.message}
                hint={`${field.value.length}/500`}
                style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }}
              />
            )}
          />
          <Controller
            control={control}
            name="jobTitle"
            render={({ field }) => (
              <TextField
                label="Meslek"
                maxLength={60}
                value={field.value}
                onChangeText={field.onChange}
                error={formState.errors.jobTitle?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="cityName"
            render={({ field }) => (
              <TextField
                label="Şehir / semt"
                placeholder="ör. Kadıköy, İstanbul"
                maxLength={80}
                value={field.value}
                onChangeText={field.onChange}
                error={formState.errors.cityName?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="heightCm"
            render={({ field }) => (
              <TextField
                label="Boy (cm)"
                keyboardType="number-pad"
                maxLength={3}
                value={field.value}
                onChangeText={(t) => field.onChange(t.replace(/\D/g, ''))}
                error={formState.errors.heightCm?.message}
              />
            )}
          />
          {(
            [
              ['smoking', 'Sigara'],
              ['drinking', 'Alkol'],
              ['exercise', 'Spor'],
            ] as const
          ).map(([name, label]) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <ChipGroup
                  label={label}
                  options={FREQUENCY_OPTIONS}
                  value={field.value as (typeof FREQUENCY_OPTIONS)[number]['value'] | null}
                  onChange={field.onChange}
                  allowClear
                />
              )}
            />
          ))}
          <Controller
            control={control}
            name="wantsChildren"
            render={({ field }) => (
              <ChipGroup
                label="Çocuk istiyor musun?"
                options={[
                  { value: 'yes', label: 'Evet' },
                  { value: 'no', label: 'Hayır' },
                ]}
                value={field.value}
                onChange={field.onChange}
                allowClear
              />
            )}
          />
          <Controller
            control={control}
            name="communicationStyle"
            render={({ field }) => (
              <ChipGroup
                label="İletişim tarzın"
                options={COMMUNICATION_STYLE_OPTIONS}
                value={field.value as (typeof COMMUNICATION_STYLE_OPTIONS)[number]['value'] | null}
                onChange={field.onChange}
                allowClear
              />
            )}
          />
          <Controller
            control={control}
            name="interestIds"
            render={({ field }) =>
              interests.data ? (
                <ChipGroup
                  label={`İlgi alanların (${field.value.length}/${MAX_INTERESTS})`}
                  multiple
                  max={MAX_INTERESTS}
                  options={interests.data.map((i) => ({ value: i.id, label: i.label }))}
                  value={field.value}
                  onChange={field.onChange}
                />
              ) : (
                <Text color="textMuted">İlgi alanları yükleniyor…</Text>
              )
            }
          />
          <Controller
            control={control}
            name="isDiscoverable"
            render={({ field }) => (
              <CheckboxRow label="Keşfette görün" checked={field.value} onChange={field.onChange}>
                <Text variant="caption" color="textMuted">
                  Kapatırsan yeni kişilere gösterilmezsin; mevcut eşleşmelerin sürer.
                </Text>
              </CheckboxRow>
            )}
          />
        </>
      ) : null}
    </View>
  );

  return (
    <FormScreen
      title={title}
      subtitle={subtitle}
      step={step}
      footer={
        <>
          {showGenericError ? <Notice message={describeError(save.error)} /> : null}
          <Button label={submitLabel} loading={save.isPending} onPress={() => void submit()} />
        </>
      }
    >
      {fields}
    </FormScreen>
  );
}
