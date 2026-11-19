import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/design/components/button';
import { FormScreen } from '@/design/components/form-screen';
import { COUNTS_FOR_ONBOARDING, PhotoManager, usePhotos } from '@/features/photos/photo-manager';
import { meQueryKey } from '@/features/session/use-me';

export default function OnboardingPhotosScreen() {
  const queryClient = useQueryClient();
  const photos = usePhotos();
  const ready = (photos.data ?? []).some((p) => COUNTS_FOR_ONBOARDING.includes(p.status));

  return (
    <FormScreen
      step="4 / 5"
      title="Fotoğrafların"
      subtitle="En az bir fotoğraf ekle. Fotoğraflar konum bilgilerinden arındırılır ve yayınlanmadan önce kontrol edilir."
      footer={
        <Button
          label="Devam et"
          disabled={!ready}
          accessibilityHint={ready ? undefined : 'Önce en az bir fotoğraf ekle'}
          onPress={() => void queryClient.invalidateQueries({ queryKey: meQueryKey })}
        />
      }
    >
      <PhotoManager />
    </FormScreen>
  );
}
