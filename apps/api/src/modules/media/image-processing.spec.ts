import sharp from 'sharp';

import { InvalidImageError, normalizePhoto } from './image-processing.js';

const image = (width: number, height: number, format: 'jpeg' | 'png' | 'gif' | 'tiff' = 'jpeg') => {
  const base = sharp({ create: { width, height, channels: 3, background: '#e85a3a' } });
  return (
    format === 'jpeg'
      ? base.jpeg()
      : format === 'png'
        ? base.png()
        : format === 'gif'
          ? base.gif()
          : base.tiff()
  ).toBuffer();
};

describe('normalizePhoto', () => {
  it('EXIF (GPS dahil) metadata’yı atar ve JPEG üretir', async () => {
    const withExif = await sharp(await image(800, 600))
      .withExif({
        IFD0: { Copyright: 'gizli-bilgi', Make: 'Telefon' },
        IFD3: { GPSLatitudeRef: 'N' },
      })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const result = await normalizePhoto(withExif);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    expect(result.buffer.includes(Buffer.from('gizli-bilgi'))).toBe(false);
  });

  it('büyük görseli 1600 px sınırına küçültür, küçükleri büyütmez', async () => {
    const big = await normalizePhoto(await image(4000, 3000));
    expect(Math.max(big.width, big.height)).toBe(1600);
    const small = await normalizePhoto(await image(500, 400));
    expect([small.width, small.height]).toEqual([500, 400]);
  });

  it('PNG kabul edilir ve JPEG’e çevrilir', async () => {
    const result = await normalizePhoto(await image(600, 600, 'png'));
    expect((await sharp(result.buffer).metadata()).format).toBe('jpeg');
  });

  it('320 px altı reddedilir', async () => {
    await expect(normalizePhoto(await image(300, 600))).rejects.toBeInstanceOf(InvalidImageError);
  });

  it('desteklenmeyen biçim (GIF, TIFF) reddedilir', async () => {
    await expect(normalizePhoto(await image(600, 600, 'gif'))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
    await expect(normalizePhoto(await image(600, 600, 'tiff'))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it('görsel olmayan dosya reddedilir (beyan edilen türe güvenilmez)', async () => {
    await expect(normalizePhoto(Buffer.from('<?php echo 1; ?>'))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });
});
