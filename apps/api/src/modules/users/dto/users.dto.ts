import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

import { AccountStatus } from '../../../generated/prisma/enums.js';

export const OnboardingStep = {
  BIRTH_DATE: 'BIRTH_DATE',
  CONSENTS: 'CONSENTS',
  COMPLETE: 'COMPLETE',
} as const;
export type OnboardingStep = (typeof OnboardingStep)[keyof typeof OnboardingStep];

export class UpdateMeDto {
  @ApiPropertyOptional({
    example: '1995-04-23',
    description: 'YYYY-MM-DD. Yalnızca bir kez girilebilir.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate YYYY-MM-DD biçiminde olmalı' })
  birthDate?: string;
}

export class DeletionInfoDto {
  @ApiProperty({ type: String, format: 'date-time' })
  requestedAt!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Bu tarihte hesap kalıcı olarak silinir',
  })
  scheduledFor!: Date;
}

export class MeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: AccountStatus, enumName: 'AccountStatus' })
  status!: AccountStatus;

  @ApiProperty({ type: String, nullable: true, example: '1995-04-23' })
  birthDate!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  age!: number | null;

  @ApiProperty({ enum: OnboardingStep, enumName: 'OnboardingStep' })
  onboardingStep!: OnboardingStep;

  @ApiProperty({ type: DeletionInfoDto, nullable: true })
  deletion!: DeletionInfoDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class MeResponseDto {
  @ApiProperty({ type: MeDto })
  data!: MeDto;
}

export class DeletionResponseDto {
  @ApiProperty({ type: DeletionInfoDto })
  data!: DeletionInfoDto;
}
