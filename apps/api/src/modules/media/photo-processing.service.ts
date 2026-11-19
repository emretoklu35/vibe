import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { InvalidImageError, MAX_UPLOAD_BYTES, normalizePhoto } from './image-processing.js';
import { IMAGE_MODERATOR, type ImageModerator } from './moderation/image-moderator.js';

export type ProcessOutcome = 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW' | 'FAILED' | 'SKIPPED';

const STALE_UPLOAD_MS = 60 * 60 * 1000;

/**
 * Worker tarafı: ham yüklemeyi çözer, metadata'yı (EXIF/GPS) temizler, yeniden kodlar, denetler.
 * Ham dosya her durumda silinir; yalnızca temizlenmiş JPEG saklanır.
 */
@Injectable()
export class PhotoProcessingService {
  private readonly logger = new Logger(PhotoProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(IMAGE_MODERATOR) private readonly moderator: ImageModerator,
  ) {}

  async process(photoId: string): Promise<ProcessOutcome> {
    const photo = await this.prisma.profilePhoto.findUnique({ where: { id: photoId } });
    // Kullanıcı bu arada sildiyse ya da iş tekrar geldiyse yapılacak bir şey yok.
    if (!photo || photo.status !== 'PROCESSING' || !photo.uploadKey) return 'SKIPPED';

    let raw: Buffer;
    try {
      const size = await this.storage.size(photo.uploadKey);
      if (size === undefined || size > MAX_UPLOAD_BYTES)
        throw new InvalidImageError('Dosya bulunamadı ya da çok büyük');
      raw = await this.storage.read(photo.uploadKey);
    } catch (error) {
      if (error instanceof InvalidImageError)
        return this.fail(photo.id, photo.uploadKey, error.message);
      throw error; // geçici depolama hatası: BullMQ tekrar dener
    }

    let processed;
    try {
      processed = await normalizePhoto(raw);
    } catch (error) {
      if (error instanceof InvalidImageError)
        return this.fail(photo.id, photo.uploadKey, error.message);
      throw error;
    }

    const moderation = await this.moderator.moderate(processed.buffer);
    await this.storage.write(photo.storageKey, processed.buffer, 'image/jpeg');
    await this.prisma.profilePhoto.update({
      where: { id: photo.id },
      data: {
        status: moderation.decision,
        width: processed.width,
        height: processed.height,
        moderationLabels: moderation.labels as object,
        uploadKey: null,
        processedAt: new Date(),
      },
    });
    await this.storage.remove([photo.uploadKey]);
    return moderation.decision;
  }

  /** Yarım kalmış yüklemeleri (1 saatten eski AWAITING_UPLOAD) ve dosyalarını temizler. */
  async cleanupStaleUploads(now = new Date()): Promise<number> {
    const stale = await this.prisma.profilePhoto.findMany({
      where: {
        status: 'AWAITING_UPLOAD',
        createdAt: { lt: new Date(now.getTime() - STALE_UPLOAD_MS) },
      },
      select: { id: true, uploadKey: true, storageKey: true },
      take: 500,
    });
    if (stale.length === 0) return 0;
    await this.storage.remove(
      stale.flatMap((p) => [p.storageKey, ...(p.uploadKey ? [p.uploadKey] : [])]),
    );
    await this.prisma.profilePhoto.deleteMany({ where: { id: { in: stale.map((p) => p.id) } } });
    return stale.length;
  }

  private async fail(photoId: string, uploadKey: string, reason: string): Promise<ProcessOutcome> {
    this.logger.warn({ photoId, reason }, 'Fotoğraf işlenemedi');
    await this.prisma.profilePhoto.update({
      where: { id: photoId },
      data: {
        status: 'FAILED',
        uploadKey: null,
        processedAt: new Date(),
        moderationLabels: { error: reason },
      },
    });
    await this.storage.remove([uploadKey]);
    return 'FAILED';
  }
}
