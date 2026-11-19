import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';

import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '../../media/image-processing.js';

export class CreateSelfieUploadDto {
  @ApiProperty({ enum: ALLOWED_UPLOAD_TYPES })
  @IsIn(ALLOWED_UPLOAD_TYPES)
  contentType!: (typeof ALLOWED_UPLOAD_TYPES)[number];

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  sizeBytes!: number;
}

export class SelfieUploadDto {
  @ApiProperty({ format: 'uuid' })
  verificationId!: string;

  @ApiProperty()
  uploadUrl!: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  uploadHeaders!: Record<string, string>;
}

export class SelfieUploadResponseDto {
  @ApiProperty({ type: SelfieUploadDto })
  data!: SelfieUploadDto;
}

export class VerificationStatusDto {
  @ApiProperty({ enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'] })
  status!: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

  @ApiProperty({ description: 'Profil doğrulanmış (rozet)' })
  verified!: boolean;

  @ApiProperty({ description: 'Moderatör doğrulama istedi; yapılana kadar keşfette görünmezsin' })
  required!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Ret gerekçesi' })
  note!: string | null;
}

export class VerificationStatusResponseDto {
  @ApiProperty({ type: VerificationStatusDto })
  data!: VerificationStatusDto;
}
