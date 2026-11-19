import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';

import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AllowDeletionPending, type AuthContext, CurrentAuth } from '../auth/auth.decorators.js';
import { ConsentsService } from './consents.service.js';
import { DataExportService } from './data-export.service.js';
import { ExportStatusResponseDto } from './dto/export.dto.js';
import { ConsentStatesResponseDto, RecordConsentsDto } from './dto/consents.dto.js';

@ApiTags('privacy')
@ApiBearerAuth()
@Controller('privacy')
export class PrivacyController {
  constructor(
    private readonly consents: ConsentsService,
    private readonly exports: DataExportService,
  ) {}

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

  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit({
    bucket: 'export-user',
    limit: 3,
    windowSeconds: 86400,
    key: (req: { auth?: AuthContext }) => req.auth?.userId,
  })
  @ApiOperation({ summary: 'Verilerimi indir (KVKK m.11): dosya arka planda hazırlanır' })
  @ApiOkResponse({ type: ExportStatusResponseDto })
  async requestExport(@CurrentAuth() auth: AuthContext): Promise<ExportStatusResponseDto> {
    return { data: await this.exports.request(auth.userId) };
  }

  @Get('export')
  @ApiOperation({ summary: 'Son dışa aktarma talebinin durumu ve indirme adresi' })
  @ApiOkResponse({ type: ExportStatusResponseDto })
  async exportStatus(@CurrentAuth() auth: AuthContext): Promise<ExportStatusResponseDto> {
    return { data: await this.exports.latest(auth.userId) };
  }
}
