import { ApiProperty } from '@nestjs/swagger';

export class LiveDataDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';
}

export class LiveResponseDto {
  @ApiProperty({ type: LiveDataDto })
  data!: LiveDataDto;
}

export class ReadinessChecksDto {
  @ApiProperty({ enum: ['up', 'down'] })
  database!: 'up' | 'down';

  @ApiProperty({ enum: ['up', 'down'] })
  redis!: 'up' | 'down';
}

export class ReadyDataDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ type: ReadinessChecksDto })
  checks!: ReadinessChecksDto;
}

export class ReadyResponseDto {
  @ApiProperty({ type: ReadyDataDto })
  data!: ReadyDataDto;
}
