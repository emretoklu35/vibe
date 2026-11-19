import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { Platform } from '../../../generated/prisma/enums.js';

export class RegisterDeviceDto {
  @ApiProperty({ enum: Platform, enumName: 'Platform' })
  @IsEnum(Platform)
  platform!: Platform;

  @ApiProperty({ description: 'Yerel FCM (Android) veya APNs (iOS) token' })
  @IsString()
  @MaxLength(512)
  @Matches(/^[A-Za-z0-9:_\-.]+$/, { message: 'pushToken geçersiz' })
  pushToken!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

  @ApiPropertyOptional({ example: 'tr-TR' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}

export class DeviceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: Platform, enumName: 'Platform' })
  platform!: Platform;
}

export class DeviceResponseDto {
  @ApiProperty({ type: DeviceDto })
  data!: DeviceDto;
}

export class NotificationSettingsDto {
  @ApiProperty({ description: 'Yeni eşleşme bildirimi' })
  @IsBoolean()
  newMatch!: boolean;

  @ApiProperty({ description: 'Yeni mesaj bildirimi' })
  @IsBoolean()
  newMessage!: boolean;
}

export class NotificationSettingsResponseDto {
  @ApiProperty({ type: NotificationSettingsDto })
  data!: NotificationSettingsDto;
}
