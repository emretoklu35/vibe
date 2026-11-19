import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Refresh token ve cihaz kimliği için kalıcı depolama.
 * iOS: Keychain, Android: Keystore (expo-secure-store).
 * Web yalnızca geliştirme önizlemesi içindir; orada localStorage kullanılır (güvenli değildir).
 */
const isWeb = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const StorageKeys = {
  refreshToken: 'vibe.refreshToken',
  deviceId: 'vibe.deviceId',
} as const;
