import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { ReportReason, ReportStatus, ReportTargetType } from '../../../generated/prisma/enums.js';

export class CreateReportDto {
  @ApiProperty({ format: 'uuid', description: 'Şikayet edilen kişi' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ enum: ReportReason, enumName: 'ReportReason' })
  @IsEnum(ReportReason)
  reason!: ReportReason;

  @ApiProperty({ enum: ReportTargetType, enumName: 'ReportTargetType' })
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @ApiPropertyOptional({ format: 'uuid', description: 'PHOTO veya MESSAGE için ilgili kimlik' })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({ description: 'Şikayetle birlikte engelle' })
  @IsOptional()
  @IsBoolean()
  alsoBlock?: boolean;
}

export class ReportCreatedDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ReportStatus, enumName: 'ReportStatus' })
  status!: ReportStatus;
}

export class ReportCreatedResponseDto {
  @ApiProperty({ type: ReportCreatedDto })
  data!: ReportCreatedDto;
}
