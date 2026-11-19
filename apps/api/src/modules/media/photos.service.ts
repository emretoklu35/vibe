import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { PhotoStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { MEDIA_QUEUE_TOKEN } from '../../infra/queue/queue.module.js';
import { PROCESS_PHOTO, type ProcessPhotoJob } from '../../infra/queue/queues.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import {
  type CreatePhotoUploadDto,
  MAX_PHOTOS,
  type PhotoDto,
  type PhotoUploadDto,
} from './dto/photos.dto.js';
import { MAX_UPLOAD_BYTES } from './image-processing.js';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const VIEW_URL_TTL_SECONDS = 10 * 60;

/** Kullanıcının kendi görebileceği, işlenmiş görseli olan durumlar. */
const VIEWABLE: PhotoStatus[] = ['APPROVED', 'NEEDS_REVIEW', 'REJECTED'];
/** Kotaya sayılan durumlar (reddedilen/başarısız fotoğraflar kullanıcı silene kadar yer tutar). */
const COUNTED: PhotoStatus[] = [
  'AWAITING_UPLOAD',
  'PROCESSING',
  'APPROVED',
  'NEEDS_REVIEW',
  'REJECTED',
  'FAILED',
];

export const photoKeys = (userId: string, photoId: string) => ({
  storageKey: `users/${userId}/photos/${photoId}.jpg`,
  uploadKey: `users/${userId}/uploads/${photoId}`,
});

export const userMediaPrefix = (userId: string) => `users/${userId}/`;

type PhotoRow = {
  id: string;
  position: number;
  status: PhotoStatus;
  storageKey: string;
  width: number | null;
  height: number | null;
};

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(MEDIA_QUEUE_TOKEN) private readonly mediaQueue: Queue,
  ) {}

  async list(userId: string): Promise<PhotoDto[]> {
    const rows = await this.prisma.profilePhoto.findMany({
      where: { userId, status: { not: 'AWAITING_UPLOAD' } },
      orderBy: { position: 'asc' },
    });
    return Promise.all(rows.map((row) => this.toDto(row)));
  }

  /**
   * Yükleme hakkı verir: satır oluşturulur ve ham dosya için kısa ömürlü bir PUT adresi döner.
   * Dosya doğrudan nesne depolamaya gider; API'den geçmez.
   */
  async createUpload(userId: string, input: CreatePhotoUploadDto): Promise<PhotoUploadDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (!profile) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.PROFILE_REQUIRED,
        'Önce profilini oluştur',
      );
    }

    const existing = await this.prisma.profilePhoto.findMany({
      where: { userId, status: { in: COUNTED } },
      select: { position: true },
    });
    if (existing.length >= MAX_PHOTOS) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.PHOTO_LIMIT_REACHED,
        `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin`,
      );
    }
    const used = new Set(existing.map((p) => p.position));
    const position = [...Array(MAX_PHOTOS).keys()].find((p) => !used.has(p)) ?? existing.length;

    const id = randomUUID();
    const keys = photoKeys(userId, id);
    const row = await this.prisma.profilePhoto.create({
      data: { id, userId, position, ...keys, status: 'AWAITING_UPLOAD' },
    });
    const uploadUrl = await this.storage.presignUpload(
      keys.uploadKey,
      input.contentType,
      input.sizeBytes,
      UPLOAD_URL_TTL_SECONDS,
    );
    return {
      photo: await this.toDto(row),
      uploadUrl,
      uploadHeaders: { 'Content-Type': input.contentType },
      expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000),
    };
  }

  /** İstemci yüklemeyi bitirdi: dosya varlığı ve boyutu doğrulanır, işleme kuyruğuna alınır. */
  async completeUpload(userId: string, photoId: string): Promise<PhotoDto> {
    const photo = await this.findOwn(userId, photoId);
    if (photo.status !== 'AWAITING_UPLOAD' || !photo.uploadKey) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.PHOTO_NOT_AWAITING_UPLOAD,
        'Bu fotoğraf zaten yüklendi',
      );
    }
    const size = await this.storage.size(photo.uploadKey);
    if (size === undefined) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.UPLOAD_NOT_FOUND,
        'Yüklenen dosya bulunamadı, lütfen tekrar dene',
      );
    }
    if (size > MAX_UPLOAD_BYTES) {
      await this.storage.remove([photo.uploadKey]);
      await this.prisma.profilePhoto.delete({ where: { id: photo.id } });
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.PHOTO_TOO_LARGE,
        'Fotoğraf en fazla 10 MB olabilir',
      );
    }

    // Koşullu geçiş: aynı fotoğraf için iki "tamamlandı" isteğinden yalnızca biri iş kuyruğa ekler.
    const { count } = await this.prisma.profilePhoto.updateMany({
      where: { id: photo.id, status: 'AWAITING_UPLOAD' },
      data: { status: 'PROCESSING' },
    });
    if (count === 1) {
      const job: ProcessPhotoJob = { photoId: photo.id };
      await this.mediaQueue.add(PROCESS_PHOTO, job, { jobId: `photo-${photo.id}` });
    }
    return this.toDto({ ...photo, status: 'PROCESSING' });
  }

  async remove(userId: string, photoId: string): Promise<void> {
    const photo = await this.findOwn(userId, photoId);
    await this.prisma.$transaction(async (tx) => {
      await tx.profilePhoto.delete({ where: { id: photo.id } });
      const rest = await tx.profilePhoto.findMany({
        where: { userId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      for (const [index, item] of rest.entries()) {
        await tx.profilePhoto.update({ where: { id: item.id }, data: { position: index } });
      }
    });
    await this.storage.remove([photo.storageKey, ...(photo.uploadKey ? [photo.uploadKey] : [])]);
  }

  /** Sıra, kullanıcının yüklenmiş fotoğraflarının tamamını içermelidir. */
  async reorder(userId: string, photoIds: string[]): Promise<PhotoDto[]> {
    const current = await this.prisma.profilePhoto.findMany({
      where: { userId, status: { not: 'AWAITING_UPLOAD' } },
      select: { id: true },
    });
    const currentIds = new Set(current.map((p) => p.id));
    if (photoIds.length !== currentIds.size || !photoIds.every((id) => currentIds.has(id))) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_PHOTO_ORDER,
        'Sıralama tüm fotoğraflarını içermeli',
      );
    }
    await this.prisma.$transaction(
      photoIds.map((id, position) =>
        this.prisma.profilePhoto.update({ where: { id }, data: { position } }),
      ),
    );
    return this.list(userId);
  }

  private async findOwn(userId: string, photoId: string) {
    const photo = await this.prisma.profilePhoto.findFirst({ where: { id: photoId, userId } });
    // Başkasının fotoğrafı için de 404: varlığı sızdırılmaz.
    if (!photo)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Fotoğraf bulunamadı');
    return photo;
  }

  private async toDto(row: PhotoRow): Promise<PhotoDto> {
    return {
      id: row.id,
      position: row.position,
      status: row.status,
      url: VIEWABLE.includes(row.status)
        ? await this.storage.presignDownload(row.storageKey, VIEW_URL_TTL_SECONDS)
        : null,
      width: row.width,
      height: row.height,
    };
  }
}
