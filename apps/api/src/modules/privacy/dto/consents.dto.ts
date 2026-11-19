import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { ConsentType } from '../../../generated/prisma/enums.js';

export class ConsentDecisionDto {
  @ApiProperty({ enum: ConsentType, enumName: 'ConsentType' })
  @IsEnum(ConsentType)
  type!: ConsentType;

  @ApiProperty()
  @IsBoolean()
  granted!: boolean;

  @ApiProperty({ description: 'Kullanıcıya gösterilen metnin sürümü (GET /app/config)' })
  @IsString()
  @MaxLength(64)
  textVersion!: string;
}

export class RecordConsentsDto {
  @ApiProperty({ type: [ConsentDecisionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConsentDecisionDto)
  decisions!: ConsentDecisionDto[];
}

export class ConsentStateDto {
  @ApiProperty({ enum: ConsentType, enumName: 'ConsentType' })
  type!: ConsentType;

  @ApiProperty()
  required!: boolean;

  @ApiProperty()
  currentVersion!: string;

  @ApiProperty()
  granted!: boolean;

  @ApiProperty({ type: String, nullable: true })
  grantedVersion!: string | null;

  @ApiProperty({ description: 'Güncel metin sürümü onaylanmış mı' })
  upToDate!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt!: Date | null;
}

export class ConsentStatesResponseDto {
  @ApiProperty({ type: [ConsentStateDto] })
  data!: ConsentStateDto[];
}
