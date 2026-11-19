import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class BlockUserDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}

export class BlockedUserDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  blockedAt!: Date;
}

export class BlocksResponseDto {
  @ApiProperty({ type: [BlockedUserDto] })
  data!: BlockedUserDto[];
}
