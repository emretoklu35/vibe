import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { ProfileCardDto } from '../../discovery/dto/discovery.dto.js';

export class TargetUserDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetUserId!: string;
}

export class LikeResultDto {
  @ApiProperty({ description: 'Karşılıklı beğeni oluştu mu' })
  matched!: boolean;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  matchId!: string | null;
}

export class LikeResponseDto {
  @ApiProperty({ type: LikeResultDto })
  data!: LikeResultDto;
}

export class MatchUserDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  age!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Ana fotoğraf (10 dk geçerli)' })
  photoUrl!: string | null;
}

export class MatchSummaryDto {
  @ApiProperty({ format: 'uuid' })
  matchId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  matchedAt!: Date;

  @ApiProperty({ type: MatchUserDto })
  user!: MatchUserDto;
}

export class MatchesQueryDto {
  @ApiPropertyOptional({ description: 'Önceki sayfanın meta.nextCursor değeri' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}

export class MatchesMetaDto {
  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class MatchesResponseDto {
  @ApiProperty({ type: [MatchSummaryDto] })
  data!: MatchSummaryDto[];

  @ApiProperty({ type: MatchesMetaDto })
  meta!: MatchesMetaDto;
}

export class MatchDetailDto {
  @ApiProperty({ format: 'uuid' })
  matchId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  matchedAt!: Date;

  @ApiProperty({ type: ProfileCardDto })
  profile!: ProfileCardDto;
}

export class MatchDetailResponseDto {
  @ApiProperty({ type: MatchDetailDto })
  data!: MatchDetailDto;
}
