import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsInt, Max, Min } from 'class-validator';

import { Gender, RelationshipGoal } from '../../../generated/prisma/enums.js';

export class PreferenceDto {
  @ApiProperty({ minimum: 18, maximum: 99 })
  minAge!: number;

  @ApiProperty({ minimum: 18, maximum: 99 })
  maxAge!: number;

  @ApiProperty({ minimum: 1, maximum: 500 })
  maxDistanceKm!: number;

  @ApiProperty({
    enum: Gender,
    enumName: 'Gender',
    isArray: true,
    description:
      'Özel nitelikli veri: yalnızca SPECIAL_CATEGORY_ORIENTATION rızası varken dolu olabilir',
  })
  seekingGenders!: Gender[];

  @ApiProperty({ enum: RelationshipGoal, enumName: 'RelationshipGoal', isArray: true })
  relationshipGoals!: RelationshipGoal[];
}

export class SetPreferencesDto {
  @ApiProperty({ minimum: 18, maximum: 99 })
  @IsInt()
  @Min(18)
  @Max(99)
  minAge!: number;

  @ApiProperty({ minimum: 18, maximum: 99 })
  @IsInt()
  @Min(18)
  @Max(99)
  maxAge!: number;

  @ApiProperty({ minimum: 1, maximum: 500 })
  @IsInt()
  @Min(1)
  @Max(500)
  maxDistanceKm!: number;

  @ApiProperty({ enum: Gender, enumName: 'Gender', isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(4)
  @IsEnum(Gender, { each: true })
  seekingGenders!: Gender[];

  @ApiProperty({ enum: RelationshipGoal, enumName: 'RelationshipGoal', isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(6)
  @IsEnum(RelationshipGoal, { each: true })
  relationshipGoals!: RelationshipGoal[];
}

export class PreferenceResponseDto {
  @ApiProperty({ type: PreferenceDto, nullable: true })
  data!: PreferenceDto | null;
}
