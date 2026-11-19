import { Controller, Get, HttpStatus } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ErrorResponseDto } from '../../common/errors/error-response.dto.js';
import { SkipRateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { LiveResponseDto, ReadyResponseDto } from './health.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('health')
@SkipRateLimit()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Süreç ayakta mı (bağımlılıklar kontrol edilmez)' })
  @ApiOkResponse({ type: LiveResponseDto })
  live(): LiveResponseDto {
    return { data: { status: 'ok' } };
  }

  @Get('ready')
  @ApiOperation({ summary: 'İstek kabul etmeye hazır mı (PostgreSQL + Redis)' })
  @ApiOkResponse({ type: ReadyResponseDto })
  @ApiServiceUnavailableResponse({ type: ErrorResponseDto })
  async ready(): Promise<ReadyResponseDto> {
    const checks = await this.health.checkDependencies();
    if (checks.database !== 'up' || checks.redis !== 'up') {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.SERVICE_UNAVAILABLE,
        'Bağımlılıklardan en az biri kullanılamıyor',
        { checks },
      );
    }
    return { data: { status: 'ok', checks } };
  }
}
