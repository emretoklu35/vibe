import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ErrorCode } from './error-codes.js';

export class ErrorBodyDto {
  @ApiProperty({ enum: Object.values(ErrorCode), example: ErrorCode.VALIDATION_FAILED })
  code!: string;

  @ApiProperty({ example: 'İstek doğrulanamadı' })
  message!: string;

  @ApiPropertyOptional({ description: 'Hataya özgü ayrıntılar (ör. alan hataları)' })
  details?: unknown;
}

export class ErrorResponseDto {
  @ApiProperty({ type: ErrorBodyDto })
  error!: ErrorBodyDto;

  @ApiProperty({ description: 'Destek ve log eşleştirmesi için istek kimliği' })
  requestId!: string;
}
