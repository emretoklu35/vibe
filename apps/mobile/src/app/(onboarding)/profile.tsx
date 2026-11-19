import { useQueryClient } from '@tanstack/react-query';

import { ProfileForm } from '@/features/profile/profile-form';
import { meQueryKey } from '@/features/session/use-me';

export default function OnboardingProfileScreen() {
  const queryClient = useQueryClient();
  return (
    <ProfileForm
      variant="onboarding"
      step="3 / 5"
      title="Seni tanıyalım"
      subtitle="Diğer bilgileri daha sonra profilinden ekleyebilirsin."
      submitLabel="Devam et"
      onSaved={() => void queryClient.invalidateQueries({ queryKey: meQueryKey })}
    />
  );
}
