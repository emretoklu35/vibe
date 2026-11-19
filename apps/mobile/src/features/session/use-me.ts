import { useQuery } from '@tanstack/react-query';

import { getMe } from '@/api/account';

import { useSessionStore } from './session-store';

export const meQueryKey = ['me'] as const;

/** Oturum açıkken hesap bilgisi; yönlendirme (onboarding adımı, silme bekliyor) buna göre yapılır. */
export function useMe() {
  const signedIn = useSessionStore((s) => s.status === 'signedIn');
  return useQuery({ queryKey: meQueryKey, queryFn: getMe, enabled: signedIn, staleTime: 60_000 });
}
