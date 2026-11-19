import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AllowDeletionPending, type AuthContext, CurrentAuth } from '../auth/auth.decorators.js';
import { ConsentsService } from './consents.service.js';
import { ConsentStatesResponseDto, RecordConsentsDto } from './dto/consents.dto.js';

@ApiTags('privacy')
@ApiBearerAuth()
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly consents: ConsentsService) {}

  @Get('consents')
  @AllowDeletionPending()
  @ApiOperation({ summary: 'Rıza durumları (belge başına en son karar)' })
  @ApiOkResponse({ type: ConsentStatesResponseDto })
  async list(@CurrentAuth() auth: AuthContext): Promise<ConsentStatesResponseDto> {
    return { data: await this.consents.getStates(auth.userId) };
  }

  @Post('consents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rıza ver / geri al (birden fazla karar tek işlemde)' })
  @ApiOkResponse({ type: ConsentStatesResponseDto })
  async record(
    @CurrentAuth() auth: AuthContext,
    @Body() body: RecordConsentsDto,
    @Ip() ip: string,
  ): Promise<ConsentStatesResponseDto> {
    await this.consents.record(auth.userId, body.decisions, ip);
    return { data: await this.consents.getStates(auth.userId) };
  }
}
