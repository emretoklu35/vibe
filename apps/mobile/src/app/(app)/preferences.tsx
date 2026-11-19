import { router } from 'expo-router';

import { PreferencesForm } from '@/features/preferences/preferences-form';
import { usePreferencesScreen } from '@/features/preferences/use-preferences-screen';
import { LoadingView, UnreachableView } from '@/features/session/status-views';

export default function PreferencesScreen() {
  const screen = usePreferencesScreen();
  if (screen.isPending) return <LoadingView />;
  if (screen.error) return <UnreachableView onRetry={() => void screen.refetch()} />;

  return (
    <PreferencesForm
      title="Keşfet tercihleri"
      submitLabel="Kaydet"
      initial={screen.preferences}
      orientationConsentGiven={screen.orientationConsentGiven}
      onSaved={() => router.back()}
    />
  );
}
