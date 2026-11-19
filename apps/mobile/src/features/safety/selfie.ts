import type { VerificationStatusDto } from '@vibe/api-contract';
import * as ImagePicker from 'expo-image-picker';

import { createSelfieUpload, submitVerification } from '@/api/safety';
import { prepareJpeg } from '@/features/photos/upload-photo';

export type SelfieOutcome =
  { kind: 'submitted'; status: VerificationStatusDto } | { kind: 'canceled' } | { kind: 'denied' };

/**
 * Ön kamerayla selfie çeker (galeriden seçilemez: eski bir fotoğraf doğrulama sayılmaz),
 * JPEG'e çevirir, doğrudan nesne depolamaya yükler ve incelemeye gönderir.
 */
export async function takeAndSubmitSelfie(): Promise<SelfieOutcome> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { kind: 'denied' };

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.front,
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { kind: 'canceled' };

  const jpegUri = await prepareJpeg(asset.uri, asset.width, asset.height);
  const blob = await (await fetch(jpegUri)).blob();
  const upload = await createSelfieUpload(blob.size);
  const put = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: upload.uploadHeaders,
    body: blob,
  });
  if (!put.ok) throw new Error(`Selfie yüklenemedi (${put.status})`);
  return { kind: 'submitted', status: await submitVerification(upload.verificationId) };
}
