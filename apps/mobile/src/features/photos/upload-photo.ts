import type { PhotoDto } from '@vibe/api-contract';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { completePhotoUpload, createPhotoUpload } from '@/api/profile';

/** Sunucu 1600 px'e küçültür; cihazda 2048 px'e indirmek yükleme süresini ve veri kullanımını azaltır. */
const MAX_UPLOAD_DIMENSION = 2048;

/**
 * Seçilen görseli JPEG'e çevirir (iPhone'un HEIC fotoğrafları sunucuda çözülemez) ve boyutunu sınırlar.
 * EXIF/konum bilgisi sunucuda da temizlenir; burada yalnızca biçim ve boyut ayarlanır.
 */
export async function prepareJpeg(uri: string, width: number, height: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  const longest = Math.max(width, height);
  if (longest > MAX_UPLOAD_DIMENSION) {
    context.resize(
      width >= height ? { width: MAX_UPLOAD_DIMENSION } : { height: MAX_UPLOAD_DIMENSION },
    );
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return result.uri;
}

/** Yükleme adresi al → dosyayı doğrudan nesne depolamaya PUT et → API'ye "tamamlandı" de. */
export async function uploadPhoto(jpegUri: string): Promise<PhotoDto> {
  const blob = await (await fetch(jpegUri)).blob();
  const upload = await createPhotoUpload({ contentType: 'image/jpeg', sizeBytes: blob.size });
  const put = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: upload.uploadHeaders,
    body: blob,
  });
  if (!put.ok) throw new Error(`Fotoğraf yüklenemedi (${put.status})`);
  return completePhotoUpload(upload.photo.id);
}
