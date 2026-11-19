import { useQuery } from '@tanstack/react-query';

import { getConsents } from '@/api/account';
import { getPreferences } from '@/api/profile';

import { consentsQueryKey, preferencesQueryKey } from './preferences-form';

/** Tercih ekranının ihtiyaç duyduğu iki veri: mevcut tercih ve özel nitelikli veri rızası. */
export function usePreferencesScreen() {
  const preferences = useQuery({ queryKey: preferencesQueryKey, queryFn: getPreferences });
  const consents = useQuery({ queryKey: consentsQueryKey, queryFn: getConsents });
  const orientation = consents.data?.find((c) => c.type === 'SPECIAL_CATEGORY_ORIENTATION');
  return {
    isPending: preferences.isPending || consents.isPending,
    error: preferences.error ?? consents.error,
    refetch: () => Promise.all([preferences.refetch(), consents.refetch()]),
    preferences: preferences.data ?? null,
    orientationConsentGiven: orientation?.upToDate ?? false,
  };
}
