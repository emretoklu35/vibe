import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { ProfileForm } from '@/features/profile/profile-form';
import { myProfileQueryKey, useMyProfile } from '@/features/profile/queries';
import { LoadingView, UnreachableView } from '@/features/session/status-views';

export default function ProfileEditScreen() {
  const queryClient = useQueryClient();
  const profile = useMyProfile();
  if (profile.isPending) return <LoadingView />;
  if (profile.isError) return <UnreachableView onRetry={() => void profile.refetch()} />;

  return (
    <ProfileForm
      variant="full"
      title="Profilini düzenle"
      submitLabel="Kaydet"
      initial={profile.data}
      onSaved={(saved) => {
        queryClient.setQueryData(myProfileQueryKey, saved);
        router.back();
      }}
    />
  );
}
