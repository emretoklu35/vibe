import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  CommunicationStyle,
  Frequency,
  Gender,
  RelationshipGoal,
} from '../../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Boş metin "yok" demektir. */
const trimToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export const MAX_INTERESTS = 10;

export class UpsertProfileDto {
  @ApiProperty({ example: 'Deniz', maxLength: 40 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  // Harf, boşluk, kesme, tire, nokta. Rakam/bağlantı yok (sahte hesap ve reklam önlemi).
  @Matches(/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u, { message: 'displayName yalnızca harf içerebilir' })
  displayName!: string;

  @ApiProperty({ enum: Gender, enumName: 'Gender' })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 60 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(60)
  jobTitle?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 120, maximum: 230 })
  @IsOptional()
  @IsInt()
  @Min(120)
  @Max(230)
  heightCm?: number | null;

  @ApiPropertyOptional({ enum: RelationshipGoal, enumName: 'RelationshipGoal', nullable: true })
  @IsOptional()
  @IsEnum(RelationshipGoal)
  relationshipGoal?: RelationshipGoal | null;

  @ApiPropertyOptional({ enum: Frequency, enumName: 'Frequency', nullable: true })
  @IsOptional()
  @IsEnum(Frequency)
  smoking?: Frequency | null;

  @ApiPropertyOptional({ enum: Frequency, enumName: 'Frequency', nullable: true })
  @IsOptional()
  @IsEnum(Frequency)
  drinking?: Frequency | null;

  @ApiPropertyOptional({ enum: Frequency, enumName: 'Frequency', nullable: true })
  @IsOptional()
  @IsEnum(Frequency)
  exercise?: Frequency | null;

  @ApiPropertyOptional({ type: Boolean, nullable: true })
  @IsOptional()
  @IsBoolean()
  wantsChildren?: boolean | null;

  @ApiPropertyOptional({ enum: CommunicationStyle, enumName: 'CommunicationStyle', nullable: true })
  @IsOptional()
  @IsEnum(CommunicationStyle)
  communicationStyle?: CommunicationStyle | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 80,
    example: 'Kadıköy, İstanbul',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(80)
  cityName?: string | null;

  @ApiPropertyOptional({ description: 'false: keşfette görünme' })
  @IsOptional()
  @IsBoolean()
  isDiscoverable?: boolean;
}

export class ProfileDto {
  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: Gender, enumName: 'Gender' })
  gender!: Gender;

  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;

  @ApiProperty({ type: String, nullable: true })
  jobTitle!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  heightCm!: number | null;

  @ApiProperty({ enum: RelationshipGoal, enumName: 'RelationshipGoal', nullable: true })
  relationshipGoal!: RelationshipGoal | null;

  @ApiProperty({ enum: Frequency, enumName: 'Frequency', nullable: true })
  smoking!: Frequency | null;

  @ApiProperty({ enum: Frequency, enumName: 'Frequency', nullable: true })
  drinking!: Frequency | null;

  @ApiProperty({ enum: Frequency, enumName: 'Frequency', nullable: true })
  exercise!: Frequency | null;

  @ApiProperty({ type: Boolean, nullable: true })
  wantsChildren!: boolean | null;

  @ApiProperty({ enum: CommunicationStyle, enumName: 'CommunicationStyle', nullable: true })
  communicationStyle!: CommunicationStyle | null;

  @ApiProperty({ type: String, nullable: true })
  cityName!: string | null;

  @ApiProperty()
  isDiscoverable!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Konum son güncelleme (koordinat dönülmez)',
  })
  locationUpdatedAt!: Date | null;
}

export class InterestDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  label!: string;
}

export class MyProfileDto {
  @ApiProperty({ type: ProfileDto, nullable: true })
  profile!: ProfileDto | null;

  @ApiProperty({ type: [InterestDto] })
  interests!: InterestDto[];
}

export class MyProfileResponseDto {
  @ApiProperty({ type: MyProfileDto })
  data!: MyProfileDto;
}

export class InterestsResponseDto {
  @ApiProperty({ type: [InterestDto] })
  data!: InterestDto[];
}

export class SetInterestsDto {
  @ApiProperty({ type: [Number], maxItems: MAX_INTERESTS })
  @IsArray()
  @ArrayMaxSize(MAX_INTERESTS)
  @ArrayUnique()
  @IsInt({ each: true })
  interestIds!: number[];
}

export class UpdateLocationDto {
  @ApiProperty({ example: 41.0082 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 28.9784 })
  @IsLongitude()
  longitude!: number;
}

export class LocationUpdatedDto {
  @ApiProperty({ type: String, format: 'date-time' })
  locationUpdatedAt!: Date;
}

export class LocationUpdatedResponseDto {
  @ApiProperty({ type: LocationUpdatedDto })
  data!: LocationUpdatedDto;
}
