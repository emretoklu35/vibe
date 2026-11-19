import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';

import { PhotoStatus } from '../../../generated/prisma/enums.js';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '../image-processing.js';

export const MAX_PHOTOS = 6;

export class CreatePhotoUploadDto {
  @ApiProperty({ enum: ALLOWED_UPLOAD_TYPES })
  @IsIn(ALLOWED_UPLOAD_TYPES)
  contentType!: (typeof ALLOWED_UPLOAD_TYPES)[number];

  @ApiProperty({ description: `Bayt cinsinden dosya boyutu (en fazla ${MAX_UPLOAD_BYTES})` })
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  sizeBytes!: number;
}

export class PhotoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: '0 = ana fotoğraf' })
  position!: number;

  @ApiProperty({ enum: PhotoStatus, enumName: 'PhotoStatus' })
  status!: PhotoStatus;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Kısa ömürlü (10 dk) görüntüleme adresi; işlenmemiş fotoğraflarda null',
  })
  url!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  width!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  height!: number | null;
}

export class PhotoUploadDto {
  @ApiProperty({ type: PhotoDto })
  photo!: PhotoDto;

  @ApiProperty({ description: 'Dosyanın PUT ile yükleneceği adres (5 dk geçerli)' })
  uploadUrl!: string;

  @ApiProperty({
    description: 'Yüklemede gönderilmesi zorunlu başlıklar',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  uploadHeaders!: Record<string, string>;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: Date;
}

export class PhotoUploadResponseDto {
  @ApiProperty({ type: PhotoUploadDto })
  data!: PhotoUploadDto;
}

export class PhotoResponseDto {
  @ApiProperty({ type: PhotoDto })
  data!: PhotoDto;
}

export class PhotosResponseDto {
  @ApiProperty({ type: [PhotoDto] })
  data!: PhotoDto[];
}

export class ReorderPhotosDto {
  @ApiProperty({ type: [String], description: 'Fotoğrafların yeni sırası (ilk = ana fotoğraf)' })
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  photoIds!: string[];
}
