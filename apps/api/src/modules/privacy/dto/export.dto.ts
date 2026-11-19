import { ApiProperty } from '@nestjs/swagger';

export class ExportStatusDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['REQUESTED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED'] })
  status!: 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

  @ApiProperty({ type: String, format: 'date-time' })
  requestedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: '10 dk geçerli indirme adresi' })
  downloadUrl!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Dosyanın silineceği an',
  })
  expiresAt!: Date | null;
}

export class ExportStatusResponseDto {
  @ApiProperty({ type: ExportStatusDto, nullable: true })
  data!: ExportStatusDto | null;
}
