import { Body, Controller, Get, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { RateLimit } from '../../src/common/rate-limit/rate-limit.decorator.js';
import { Public } from '../../src/modules/auth/auth.decorators.js';

class NestedDto {
  @IsString()
  @MaxLength(5)
  label!: string;
}

export class EchoDto {
  @IsInt()
  @Min(18)
  @Max(99)
  age!: number;

  @ValidateNested()
  @Type(() => NestedDto)
  nested!: NestedDto;
}

/** Yalnızca testlerde yüklenir: ortak HTTP katmanını (doğrulama, rate limit) uçtan uca sınamak için. */
@Public()
@Controller('__test')
export class FixturesController {
  @Post('echo')
  echo(@Body() body: EchoDto): { data: EchoDto } {
    return { data: body };
  }

  @Get('limited')
  @RateLimit({ bucket: 'test-limited', limit: 2, windowSeconds: 60 })
  limited(): { data: { ok: true } } {
    return { data: { ok: true } };
  }

  @Get('fail-closed')
  @RateLimit({ bucket: 'test-fail-closed', limit: 100, windowSeconds: 60, failClosed: true })
  failClosed(): { data: { ok: true } } {
    return { data: { ok: true } };
  }

  @Get('boom')
  boom(): never {
    throw new Error('iç ayrıntı: veritabanı parolası xyz');
  }
}
