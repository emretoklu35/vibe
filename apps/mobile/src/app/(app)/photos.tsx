import { router } from 'expo-router';

import { Button } from '@/design/components/button';
import { FormScreen } from '@/design/components/form-screen';
import { PhotoManager } from '@/features/photos/photo-manager';

export default function PhotosScreen() {
  return (
    <FormScreen
      title="Fotoğrafların"
      subtitle="Bir fotoğrafa dokunarak ana fotoğraf yapabilir ya da silebilirsin."
      footer={<Button label="Tamam" variant="secondary" onPress={() => router.back()} />}
    >
      <PhotoManager />
    </FormScreen>
  );
}
