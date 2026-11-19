import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { requestOtp } from '@/api/auth';
import { Button } from '@/design/components/button';
import { FormScreen } from '@/design/components/form-screen';
import { Notice } from '@/design/components/notice';
import { TextField } from '@/design/components/text-field';
import { describeError } from '@/features/auth/error-message';
import { usePendingPhone } from '@/features/auth/pending-phone';
import { formatPhoneInput, hasTenDigits, toApiPhone } from '@/features/auth/phone-input';

const schema = z.object({
  phone: z.string().refine(hasTenDigits, 'Numaranı 10 hane olarak gir (ör. 532 123 45 67)'),
});
type FormValues = z.infer<typeof schema>;

export default function PhoneScreen() {
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '' },
  });

  const setPendingPhone = usePendingPhone((s) => s.setPhone);
  const send = useMutation({
    mutationFn: (phone: string) => requestOtp(phone),
    onSuccess: (_data, phone) => {
      setPendingPhone(phone);
      router.push('/code');
    },
  });

  const submit = handleSubmit(({ phone }) => send.mutate(toApiPhone(phone)));

  return (
    <FormScreen
      title="Telefon numaran"
      subtitle="Sana bir doğrulama kodu göndereceğiz. Numaran profilinde görünmez."
      footer={
        <>
          {send.isError ? <Notice message={describeError(send.error)} /> : null}
          <Button label="Kod gönder" onPress={submit} loading={send.isPending} />
          <Button label="Geri" variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <TextField
            label="Cep telefonu (+90)"
            placeholder="532 123 45 67"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel-national"
            autoFocus
            returnKeyType="send"
            value={field.value}
            onChangeText={(text) => field.onChange(formatPhoneInput(text))}
            onBlur={field.onBlur}
            onSubmitEditing={() => void submit()}
            error={formState.errors.phone?.message}
            maxLength={13}
          />
        )}
      />
    </FormScreen>
  );
}
