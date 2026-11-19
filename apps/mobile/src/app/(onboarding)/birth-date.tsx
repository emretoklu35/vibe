import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { setBirthDate } from '@/api/account';
import { ApiError } from '@/api/client';
import { Button } from '@/design/components/button';
import { FormScreen } from '@/design/components/form-screen';
import { Notice } from '@/design/components/notice';
import { TextField } from '@/design/components/text-field';
import { describeError } from '@/features/auth/error-message';
import { formatBirthDateInput, toIsoBirthDate } from '@/features/onboarding/birth-date';
import { clearLocalSession } from '@/features/session/session';
import { meQueryKey } from '@/features/session/use-me';

const schema = z.object({
  birthDate: z
    .string()
    .refine((v) => toIsoBirthDate(v) !== undefined, 'Geçerli bir tarih gir (GG.AA.YYYY)'),
});
type FormValues = z.infer<typeof schema>;

export default function BirthDateScreen() {
  const queryClient = useQueryClient();
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { birthDate: '' },
  });

  const save = useMutation({
    mutationFn: (iso: string) => setBirthDate(iso),
    onSuccess: (me) => queryClient.setQueryData(meQueryKey, me),
    onError: async (error) => {
      // 18 yaş altı: sunucu hesabı sildi; yerel oturum kapatılır ve açıklama giriş ekranında gösterilir.
      if (error instanceof ApiError && error.code === 'UNDERAGE')
        await clearLocalSession(error.message);
    },
  });

  const submit = handleSubmit(({ birthDate }) => save.mutate(toIsoBirthDate(birthDate)!));

  return (
    <FormScreen
      step="1 / 5"
      title="Doğum tarihin"
      subtitle="VIBE 18 yaş ve üzeri içindir. Profilinde yalnızca yaşın görünür."
      footer={
        <>
          {save.isError ? <Notice message={describeError(save.error)} /> : null}
          <Button label="Devam et" onPress={submit} loading={save.isPending} />
        </>
      }
    >
      <Controller
        control={control}
        name="birthDate"
        render={({ field }) => (
          <TextField
            label="Doğum tarihi"
            placeholder="GG.AA.YYYY"
            keyboardType="number-pad"
            autoComplete="birthdate-full"
            autoFocus
            maxLength={10}
            value={field.value}
            onChangeText={(text) => field.onChange(formatBirthDateInput(text))}
            onBlur={field.onBlur}
            onSubmitEditing={() => void submit()}
            error={formState.errors.birthDate?.message}
            hint="Doğum tarihin daha sonra değiştirilemez."
          />
        )}
      />
    </FormScreen>
  );
}
