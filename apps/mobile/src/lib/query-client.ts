import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // 4xx hataları tekrar denemekle düzelmez; yalnızca ağ/5xx hatalarında 2 kez dene.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          (!(error instanceof ApiError) || error.isNetworkError || error.status >= 500),
      },
    },
  });
}
