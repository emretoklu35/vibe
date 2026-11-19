import sharp from 'sharp';

export const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedUploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MIN_DIMENSION = 320;
const MAX_OUTPUT_DIMENSION = 1600;
/** Sıkıştırma bombalarına karşı: en fazla ~40 MP. */
const MAX_INPUT_PIXELS = 40_000_000;

export class InvalidImageError extends Error {}

export type ProcessedImage = { buffer: Buffer; width: number; height: number };

/**
 * İstemcinin beyan ettiği türe güvenilmez: dosya gerçekten çözülür.
 * Çıktı her zaman JPEG'dir; EXIF/GPS dahil tüm metadata atılır, yön (orientation) piksellere uygulanır.
 */
export async function normalizePhoto(input: Buffer): Promise<ProcessedImage> {
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    metadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new InvalidImageError('Dosya okunabilir bir görsel değil');
  }
  if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw new InvalidImageError('Yalnızca JPEG, PNG veya WebP yüklenebilir');
  }
  if ((metadata.pages ?? 1) > 1) throw new InvalidImageError('Hareketli görseller desteklenmiyor');

  const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize(MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  if (Math.min(info.width, info.height) < MIN_DIMENSION) {
    throw new InvalidImageError(`Görsel en az ${MIN_DIMENSION}×${MIN_DIMENSION} piksel olmalı`);
  }
  return { buffer: data, width: info.width, height: info.height };
}
