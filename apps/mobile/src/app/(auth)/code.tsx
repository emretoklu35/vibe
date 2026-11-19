import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { requestOtp, verifyOtp } from '@/api/auth';
import { ApiError } from '@/api/client';
import { Button } from '@/design/components/button';
import { FormScreen } from '@/design/components/form-screen';
import { Notice } from '@/design/components/notice';
import { TextField } from '@/design/components/text-field';
import { describeError } from '@/features/auth/error-message';
import { usePendingPhone } from '@/features/auth/pending-phone';
import { formatPhoneInput } from '@/features/auth/phone-input';
import { completeSignIn } from '@/features/session/session';

const RESEND_AFTER_SECONDS = 60;

const schema = z.object({ code: z.string().regex(/^\d{6}$/, '6 haneli kodu gir') });
type FormValues = z.infer<typeof schema>;

export default function CodeScreen() {
  const phone = usePendingPhone((s) => s.phone);
  // Numara olmadan (ör. doğrudan bağlantı veya sayfa yenileme) gelinirse numara ekranına dön.
  if (!phone) return <Redirect href="/phone" />;
  return <CodeForm phone={phone} />;
}

function CodeForm({ phone }: { phone: string }) {
  const [resendIn, setResendIn] = useState(RESEND_AFTER_SECONDS);
  const { control, handleSubmit, formState, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const verify = useMutation({
    mutationFn: (code: string) => verifyOtp(phone, code),
    // Oturum açılınca yönlendirici kullanıcıyı onboarding'in doğru adımına götürür.
    onSuccess: (result) => completeSignIn(result.tokens),
    onError: (error) => {
      if (
        error instanceof ApiError &&
        ['OTP_EXPIRED', 'OTP_TOO_MANY_ATTEMPTS'].includes(error.code)
      ) {
        reset({ code: '' });
      }
    },
  });

  const resend = useMutation({
    mutationFn: () => requestOtp(phone),
    onSuccess: () => {
      setResendIn(RESEND_AFTER_SECONDS);
      verify.reset();
      reset({ code: '' });
    },
  });

  const submit = handleSubmit(({ code }) => verify.mutate(code));
  const error = verify.error ?? resend.error;

  return (
    <FormScreen
      title="Doğrulama kodu"
      subtitle={`+90 ${formatPhoneInput(phone.slice(3))} numarasına gönderilen 6 haneli kodu gir.`}
      footer={
        <>
          {error ? <Notice message={describeError(error)} /> : null}
          <Button label="Doğrula" onPress={submit} loading={verify.isPending} />
          <Button
            label={resendIn > 0 ? `Yeni kod (${resendIn} sn)` : 'Yeni kod gönder'}
            variant="secondary"
            disabled={resendIn > 0}
            loading={resend.isPending}
            onPress={() => resend.mutate()}
          />
          <Button label="Numarayı değiştir" variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label="Kod"
            placeholder="••••••"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            maxLength={6}
            value={field.value}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '').slice(0, 6);
              field.onChange(digits);
              // 6 hane tamamlanınca (SMS otomatik doldurma dahil) kendiliğinden doğrula.
              if (digits.length === 6 && !verify.isPending) verify.mutate(digits);
            }}
            onBlur={field.onBlur}
            error={formState.errors.code?.message}
            style={{ letterSpacing: 8 }}
          />
        )}
      />
    </FormScreen>
  );
}
