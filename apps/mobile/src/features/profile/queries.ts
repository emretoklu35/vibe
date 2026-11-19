import { useQuery } from '@tanstack/react-query';

import { getMyProfile } from '@/api/profile';

export const myProfileQueryKey = ['my-profile'] as const;

export const useMyProfile = () => useQuery({ queryKey: myProfileQueryKey, queryFn: getMyProfile });
