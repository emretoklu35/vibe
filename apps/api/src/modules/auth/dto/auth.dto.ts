import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { AccountStatus } from '../../../generated/prisma/enums.js';
import { OnboardingStep } from '../../users/dto/users.dto.js';

export class RequestOtpDto {
  @ApiProperty({
    example: '+905321234567',
    description: 'Türkiye cep telefonu (çeşitli yazımlar kabul edilir)',
  })
  @IsString()
  @MaxLength(32)
  phone!: string;
}

export class RequestOtpResponseDataDto {
  @ApiProperty({ example: 300 })
  expiresInSeconds!: number;
}

export class RequestOtpResponseDto {
  @ApiProperty({ type: RequestOtpResponseDataDto })
  data!: RequestOtpResponseDataDto;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+905321234567' })
  @IsString()
  @MaxLength(32)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'code 6 haneli olmalı' })
  code!: string;

  @ApiPropertyOptional({
    description: 'Cihazda üretilen kalıcı kimlik (oturum listesinde gösterilir)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  refreshToken!: string;
}

export class TokenPairDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  accessTokenExpiresAt!: Date;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  refreshTokenExpiresAt!: Date;
}

export class TokenPairResponseDto {
  @ApiProperty({ type: TokenPairDto })
  data!: TokenPairDto;
}

export class SignInUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Bu girişte yeni hesap oluşturuldu mu' })
  isNew!: boolean;

  @ApiProperty({ enum: AccountStatus, enumName: 'AccountStatus' })
  status!: AccountStatus;

  @ApiProperty({ enum: OnboardingStep, enumName: 'OnboardingStep' })
  onboardingStep!: OnboardingStep;
}

export class SignInDataDto {
  @ApiProperty({ type: TokenPairDto })
  tokens!: TokenPairDto;

  @ApiProperty({ type: SignInUserDto })
  user!: SignInUserDto;
}

export class SignInResponseDto {
  @ApiProperty({ type: SignInDataDto })
  data!: SignInDataDto;
}

export class SessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  deviceId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  userAgent!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  lastUsedAt!: Date;

  @ApiProperty({ description: 'İsteği yapan oturum mu' })
  current!: boolean;
}

export class SessionsResponseDto {
  @ApiProperty({ type: [SessionDto] })
  data!: SessionDto[];
}
