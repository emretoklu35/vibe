import * as Crypto from 'expo-crypto';

import { getItem, setItem, StorageKeys } from './secure-storage';

let cached: string | undefined;

/** Uygulama kurulumuna özgü kalıcı kimlik (donanım kimliği değildir; oturum listesinde gösterilir). */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const stored = await getItem(StorageKeys.deviceId);
  if (stored) {
    cached = stored;
    return stored;
  }
  const created = Crypto.randomUUID();
  await setItem(StorageKeys.deviceId, created);
  cached = created;
  return created;
}
