import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  AdminRole,
  PhotoStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '../../../generated/prisma/enums.js';

export class AdminLoginDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'totp 6 haneli olmalı' })
  totp!: string;
}

export class AdminIdentityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: AdminRole, enumName: 'AdminRole' })
  role!: AdminRole;
}

export class AdminLoginDataDto {
  @ApiProperty()
  token!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({ type: AdminIdentityDto })
  admin!: AdminIdentityDto;
}

export class AdminLoginResponseDto {
  @ApiProperty({ type: AdminLoginDataDto })
  data!: AdminLoginDataDto;
}

export class AdminMeResponseDto {
  @ApiProperty({ type: AdminIdentityDto })
  data!: AdminIdentityDto;
}

export class ReportsQueryDto {
  @ApiPropertyOptional({ enum: ReportStatus, enumName: 'ReportStatus' })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}

export class ReportSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ReportReason, enumName: 'ReportReason' })
  reason!: ReportReason;

  @ApiProperty({ enum: ReportStatus, enumName: 'ReportStatus' })
  status!: ReportStatus;

  @ApiProperty({ enum: ReportTargetType, enumName: 'ReportTargetType' })
  targetType!: ReportTargetType;

  @ApiProperty()
  priority!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  reportedUserId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  reportedName!: string | null;

  @ApiProperty({ description: 'Bu kişi hakkındaki açık şikayet sayısı' })
  openReportsAgainst!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class ReportsResponseDto {
  @ApiProperty({ type: [ReportSummaryDto] })
  data!: ReportSummaryDto[];
}

export class ReportDetailDto extends ReportSummaryDto {
  @ApiProperty({ type: String, nullable: true })
  comment!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  reporterId!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Şikayet anındaki kanıt',
  })
  evidence!: Record<string, unknown>;

  @ApiProperty({ type: [String], description: 'Kanıt fotoğrafları (10 dk geçerli adresler)' })
  evidencePhotoUrls!: string[];

  @ApiProperty({ type: String, nullable: true })
  resolutionNote!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  handledBy!: string | null;
}

export class ReportDetailResponseDto {
  @ApiProperty({ type: ReportDetailDto })
  data!: ReportDetailDto;
}

export class UpdateReportDto {
  @ApiProperty({ enum: ['IN_REVIEW', 'ACTION_TAKEN', 'DISMISSED'] })
  @IsIn(['IN_REVIEW', 'ACTION_TAKEN', 'DISMISSED'])
  status!: 'IN_REVIEW' | 'ACTION_TAKEN' | 'DISMISSED';

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReviewPhotoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: PhotoStatus, enumName: 'PhotoStatus' })
  status!: PhotoStatus;

  @ApiProperty()
  url!: string;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  labels!: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class ReviewPhotosResponseDto {
  @ApiProperty({ type: [ReviewPhotoDto] })
  data!: ReviewPhotoDto[];
}

export class DecisionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ maxLength: 500, description: 'Selfie reddinde kullanıcıya gösterilir' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class VerificationReviewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  submittedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  selfieUrl!: string | null;

  @ApiProperty({ type: [String] })
  profilePhotoUrls!: string[];
}

export class VerificationsResponseDto {
  @ApiProperty({ type: [VerificationReviewDto] })
  data!: VerificationReviewDto[];
}

export class AdminUserPhotoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: PhotoStatus, enumName: 'PhotoStatus' })
  status!: PhotoStatus;

  @ApiProperty({ type: String, nullable: true })
  url!: string | null;
}

export class AdminUserReportDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ReportReason, enumName: 'ReportReason' })
  reason!: ReportReason;

  @ApiProperty({ enum: ReportStatus, enumName: 'ReportStatus' })
  status!: ReportStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class AdminUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  suspendedUntil!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  age!: number | null;

  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;

  @ApiProperty()
  verified!: boolean;

  @ApiProperty()
  verificationRequired!: boolean;

  @ApiProperty()
  moderationHold!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  lastActiveAt!: Date;

  @ApiProperty({ type: [AdminUserPhotoDto] })
  photos!: AdminUserPhotoDto[];

  @ApiProperty({ type: [AdminUserReportDto], description: 'Bu kişi hakkındaki şikayetler' })
  reportsAgainst!: AdminUserReportDto[];

  @ApiProperty()
  reportsFiled!: number;
}

export class AdminUserResponseDto {
  @ApiProperty({ type: AdminUserDto })
  data!: AdminUserDto;
}

export const UserAction = {
  SUSPEND: 'SUSPEND',
  BAN: 'BAN',
  RESTORE: 'RESTORE',
  REQUIRE_VERIFICATION: 'REQUIRE_VERIFICATION',
  HOLD: 'HOLD',
  RELEASE_HOLD: 'RELEASE_HOLD',
} as const;
export type UserAction = (typeof UserAction)[keyof typeof UserAction];

export class UserActionDto {
  @ApiProperty({ enum: UserAction, enumName: 'UserAction' })
  @IsEnum(UserAction)
  action!: UserAction;

  @ApiProperty({ minLength: 5, maxLength: 500, description: 'Denetim kaydına yazılır' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 365, description: 'SUSPEND için gün' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class AuditLogDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  adminEmail!: string | null;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  targetType!: string;

  @ApiProperty({ type: String, nullable: true })
  targetId!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class AuditLogsResponseDto {
  @ApiProperty({ type: [AuditLogDto] })
  data!: AuditLogDto[];
}
