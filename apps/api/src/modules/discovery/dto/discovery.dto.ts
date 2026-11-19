import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  CommunicationStyle,
  Frequency,
  Gender,
  RelationshipGoal,
} from '../../../generated/prisma/enums.js';
import { InterestDto } from '../../profiles/dto/profile.dto.js';

export const DiscoveryRequirement = {
  PROFILE: 'PROFILE',
  APPROVED_PHOTO: 'APPROVED_PHOTO',
  LOCATION: 'LOCATION',
  ORIENTATION_CONSENT: 'ORIENTATION_CONSENT',
  SEEKING_GENDERS: 'SEEKING_GENDERS',
  VISIBLE: 'VISIBLE',
  /** Moderatör selfie doğrulaması istedi (K11) */
  VERIFICATION: 'VERIFICATION',
  /** Hesap inceleme altında */
  UNDER_REVIEW: 'UNDER_REVIEW',
} as const;
export type DiscoveryRequirement = (typeof DiscoveryRequirement)[keyof typeof DiscoveryRequirement];

export class DiscoveryStatusDto {
  @ApiProperty()
  ready!: boolean;

  @ApiProperty({
    enum: DiscoveryRequirement,
    enumName: 'DiscoveryRequirement',
    isArray: true,
    description: 'Keşfeti açmak için eksik olanlar',
  })
  missing!: DiscoveryRequirement[];
}

export class DiscoveryStatusResponseDto {
  @ApiProperty({ type: DiscoveryStatusDto })
  data!: DiscoveryStatusDto;
}

export class CandidatesQueryDto {
  @ApiProperty({ required: false, minimum: 1, maximum: 20, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class CardPhotoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Kısa ömürlü (10 dk) adres' })
  url!: string;

  @ApiProperty({ type: Number, nullable: true })
  width!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  height!: number | null;
}

export class CompatibilityDto {
  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description: 'Kural tabanlı uyum puanı; kesinlik iddiası taşımaz',
  })
  score!: number;

  @ApiProperty({ type: [String], example: ['2 ortak ilgi alanı: Kahve, Caz'] })
  reasons!: string[];
}

/** Başka bir kullanıcının profil kartı. Aranan cinsiyet ve kesin konum asla yer almaz. */
export class ProfileCardDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  age!: number;

  @ApiProperty({ enum: Gender, enumName: 'Gender' })
  gender!: Gender;

  @ApiProperty({ description: 'Selfie doğrulaması onaylı (rozet)' })
  verified!: boolean;

  @ApiProperty({ type: String, nullable: true })
  cityName!: string | null;

  @ApiProperty({
    example: '3 km',
    description: 'Yuvarlanmış mesafe; ör. "2 km\'den yakın", "100+ km"',
  })
  distanceLabel!: string;

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

  @ApiProperty({ type: [InterestDto] })
  interests!: InterestDto[];

  @ApiProperty({ type: [CardPhotoDto], description: 'Yalnızca onaylı fotoğraflar, sıralı' })
  photos!: CardPhotoDto[];

  @ApiProperty({ type: CompatibilityDto })
  compatibility!: CompatibilityDto;
}

export class CandidatesResponseDto {
  @ApiProperty({ type: [ProfileCardDto] })
  data!: ProfileCardDto[];
}
