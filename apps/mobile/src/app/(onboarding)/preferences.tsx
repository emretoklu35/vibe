import { useQueryClient } from '@tanstack/react-query';

import { PreferencesForm } from '@/features/preferences/preferences-form';
import { usePreferencesScreen } from '@/features/preferences/use-preferences-screen';
import { meQueryKey } from '@/features/session/use-me';
import { LoadingView, UnreachableView } from '@/features/session/status-views';

export default function OnboardingPreferencesScreen() {
  const queryClient = useQueryClient();
  const screen = usePreferencesScreen();
  if (screen.isPending) return <LoadingView />;
  if (screen.error) return <UnreachableView onRetry={() => void screen.refetch()} />;

  return (
    <PreferencesForm
      step="5 / 5"
      title="Kimi arıyorsun?"
      subtitle="Keşfette sana kimlerin gösterileceğini belirle. Sonradan değiştirebilirsin."
      submitLabel="Kaydet ve bitir"
      initial={screen.preferences}
      orientationConsentGiven={screen.orientationConsentGiven}
      onSaved={() => void queryClient.invalidateQueries({ queryKey: meQueryKey })}
    />
  );
}
