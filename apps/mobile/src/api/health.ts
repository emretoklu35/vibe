import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';

type LiveResponse = { data: { status: 'ok' } };

/** API'ye ulaşılabiliyor mu? Geliştirme ortamında bağlantı ayarını doğrulamak için. */
export function useApiLiveness() {
  return useQuery({
    queryKey: ['health', 'live'],
    queryFn: ({ signal }) => apiRequest<LiveResponse>('/health/live', { signal, timeoutMs: 5_000 }),
    retry: false,
  });
}
