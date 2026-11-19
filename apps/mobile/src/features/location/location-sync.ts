import * as Location from 'expo-location';

import { sendLocation } from '@/api/discovery';

/** Konum en fazla bu sıklıkla sessizce güncellenir (sunucu da saatte 6 ile sınırlar). */
export const LOCATION_REFRESH_MS = 6 * 60 * 60 * 1000;

export type LocationOutcome = 'sent' | 'denied' | 'unavailable';

/**
 * Yaklaşık konumu alıp sunucuya gönderir. Sunucu koordinatı bulanıklaştırarak saklar;
 * cihazda da hassasiyet "Balanced" (≈100 m) ile sınırlıdır, GPS kesinliği istenmez.
 */
export async function shareLocation(options: { ask: boolean }): Promise<LocationOutcome> {
  const current = await Location.getForegroundPermissionsAsync();
  let granted = current.granted;
  if (!granted && options.ask && current.canAskAgain) {
    granted = (await Location.requestForegroundPermissionsAsync()).granted;
  }
  if (!granted) return 'denied';

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await sendLocation(position.coords.latitude, position.coords.longitude);
    return 'sent';
  } catch {
    return 'unavailable';
  }
}
