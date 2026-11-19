import type { LegalDocumentSummaryDto } from '@vibe/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { getAppConfig, recordConsents } from '@/api/account';
import { ApiError } from '@/api/client';
import { Button } from '@/design/components/button';
import { CheckboxRow } from '@/design/components/checkbox-row';
import { FormScreen } from '@/design/components/form-screen';
import { Notice } from '@/design/components/notice';
import { useTheme } from '@/design/theme';
import { describeError } from '@/features/auth/error-message';
import { meQueryKey } from '@/features/session/use-me';
import { LoadingView, UnreachableView } from '@/features/session/status-views';

const appConfigKey = ['app-config'] as const;

function checkboxLabel(doc: LegalDocumentSummaryDto): string {
  return doc.kind === 'acknowledgement'
    ? `${doc.title}'ni okudum`
    : doc.required
      ? `${doc.title}'nı kabul ediyorum`
      : doc.title;
}

export default function ConsentsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: appConfigKey, queryFn: getAppConfig });
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: (docs: LegalDocumentSummaryDto[]) =>
      recordConsents(
        docs
          .filter((d) => d.required || checked[d.type])
          .map((d) => ({ type: d.type, granted: true, textVersion: d.version })),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meQueryKey }),
    onError: async (error) => {
      // Metin bu arada güncellendiyse: yeni sürümü yükle, kullanıcı tekrar onaylasın.
      if (error instanceof ApiError && error.code === 'CONSENT_VERSION_MISMATCH') {
        setChecked({});
        await config.refetch();
      }
    },
  });

  if (config.isPending) return <LoadingView />;
  if (config.isError)
    return <UnreachableView onRetry={() => void config.refetch()} busy={config.isFetching} />;

  const docs = config.data.legalDocuments;
  const allRequired = docs.filter((d) => d.required).every((d) => checked[d.type]);

  return (
    <FormScreen
      step="2 / 2"
      title="Gizlilik ve koşullar"
      subtitle="Verilerini nasıl işlediğimizi ve topluluk kurallarımızı oku. Yıldızlı olanlar zorunludur."
      footer={
        <>
          {save.isError ? <Notice message={describeError(save.error)} /> : null}
          <Button
            label="Onayla ve devam et"
            disabled={!allRequired}
            loading={save.isPending}
            onPress={() => save.mutate(docs)}
            accessibilityHint={allRequired ? undefined : 'Önce zorunlu maddeleri işaretle'}
          />
        </>
      }
    >
      <View style={{ gap: theme.spacing.md }}>
        {docs.map((doc) => (
          <CheckboxRow
            key={doc.type}
            label={checkboxLabel(doc)}
            required={doc.required}
            checked={Boolean(checked[doc.type])}
            onChange={(value) => setChecked((prev) => ({ ...prev, [doc.type]: value }))}
          >
            <Button
              label="Metni oku"
              variant="ghost"
              onPress={() => router.push({ pathname: '/legal/[type]', params: { type: doc.type } })}
            />
          </CheckboxRow>
        ))}
      </View>
    </FormScreen>
  );
}
