import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { InvalidImageError, MAX_UPLOAD_BYTES, normalizePhoto } from '../media/image-processing.js';
import type {
  CreateSelfieUploadDto,
  SelfieUploadDto,
  VerificationStatusDto,
} from './dto/verification.dto.js';

const UPLOAD_TTL_SECONDS = 5 * 60;

const selfieKeys = (userId: string, id: string) => ({
  selfieKey: `users/${userId}/verification/${id}.jpg`,
  uploadKey: `users/${userId}/uploads/verification-${id}`,
});

/**
 * Selfie doğrulaması (K11/K12): kullanıcı selfie yükler, moderatör profil fotoğraflarıyla karşılaştırır.
 * Selfie yalnızca bu amaçla tutulur, EXIF'i temizlenir ve karardan 30 gün sonra silinir.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async status(userId: string): Promise<VerificationStatusDto> {
    const [user, latest] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { verifiedAt: true, verificationRequired: true },
      }),
      this.prisma.verification.findFirst({
        where: { userId, submittedAt: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { status: true, note: true },
      }),
    ]);
    return {
      status: latest?.status ?? 'NONE',
      verified: user.verifiedAt !== null,
      required: user.verificationRequired,
      note: latest?.status === 'REJECTED' ? latest.note : null,
    };
  }

  async createUpload(userId: string, input: CreateSelfieUploadDto): Promise<SelfieUploadDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { verifiedAt: true },
    });
    if (user.verifiedAt) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.ALREADY_VERIFIED,
        'Profilin zaten doğrulanmış',
      );
    }
    await this.assertNoPending(userId);
    const id = randomUUID();
    const keys = selfieKeys(userId, id);
    await this.prisma.verification.create({ data: { id, userId, uploadKey: keys.uploadKey } });
    return {
      verificationId: id,
      uploadUrl: await this.storage.presignUpload(
        keys.uploadKey,
        input.contentType,
        input.sizeBytes,
        UPLOAD_TTL_SECONDS,
      ),
      uploadHeaders: { 'Content-Type': input.contentType },
    };
  }

  /** Yüklenen selfie doğrulanır, temizlenir ve moderatör kuyruğuna girer. */
  async submit(userId: string, verificationId: string): Promise<VerificationStatusDto> {
    const verification = await this.prisma.verification.findFirst({
      where: { id: verificationId, userId, submittedAt: null },
    });
    if (!verification?.uploadKey) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Doğrulama bulunamadı');
    }
    await this.assertNoPending(userId);
    const size = await this.storage.size(verification.uploadKey);
    if (size === undefined) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.UPLOAD_NOT_FOUND,
        'Selfie bulunamadı, tekrar dene',
      );
    }
    if (size > MAX_UPLOAD_BYTES) {
      await this.storage.remove([verification.uploadKey]);
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.PHOTO_TOO_LARGE,
        'Selfie en fazla 10 MB olabilir',
      );
    }

    let processed;
    try {
      processed = await normalizePhoto(await this.storage.read(verification.uploadKey));
    } catch (error) {
      await this.storage.remove([verification.uploadKey]);
      if (error instanceof InvalidImageError) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          ErrorCode.UNSUPPORTED_MEDIA_TYPE,
          error.message,
        );
      }
      throw error;
    }

    const { selfieKey } = selfieKeys(userId, verification.id);
    await this.storage.write(selfieKey, processed.buffer, 'image/jpeg');
    await this.storage.remove([verification.uploadKey]);
    await this.prisma.verification.update({
      where: { id: verification.id },
      data: { selfieKey, uploadKey: null, submittedAt: new Date(), status: 'PENDING' },
    });
    return this.status(userId);
  }

  private async assertNoPending(userId: string): Promise<void> {
    const pending = await this.prisma.verification.findFirst({
      where: { userId, status: 'PENDING', submittedAt: { not: null } },
      select: { id: true },
    });
    if (pending) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.VERIFICATION_ALREADY_PENDING,
        'Doğrulaman inceleniyor; sonuçlanınca tekrar deneyebilirsin',
      );
    }
  }
}
