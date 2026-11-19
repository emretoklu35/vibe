import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { type AuthContext, CurrentAuth } from '../auth/auth.decorators.js';
import { CreateReportDto, ReportCreatedResponseDto } from './dto/reports.dto.js';
import {
  CreateSelfieUploadDto,
  SelfieUploadResponseDto,
  VerificationStatusResponseDto,
} from './dto/verification.dto.js';
import { ReportsService } from './reports.service.js';
import { VerificationService } from './verification.service.js';

const byUser = (req: { auth?: AuthContext }) => req.auth?.userId;

@ApiTags('safety')
@ApiBearerAuth()
@Controller('safety')
export class SafetyController {
  constructor(
    private readonly reports: ReportsService,
    private readonly verification: VerificationService,
  ) {}

  @Post('reports')
  @RateLimit({ bucket: 'report-user', limit: 10, windowSeconds: 3600, key: byUser })
  @ApiOperation({
    summary: 'Şikayet et',
    description:
      'Kanıt şikayet anında saklanır. Reşit olmayan şikayetinde ve farklı kişilerden 3 açık şikayette hesap inceleme bitene kadar keşfetten gizlenir. Aynı içerik tekrar şikayet edilirse yeni kayıt açılmaz.',
  })
  @ApiCreatedResponse({ type: ReportCreatedResponseDto })
  async report(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateReportDto,
  ): Promise<ReportCreatedResponseDto> {
    return { data: await this.reports.create(auth.userId, body) };
  }

  @Get('verification')
  @ApiOperation({ summary: 'Selfie doğrulama durumu' })
  @ApiOkResponse({ type: VerificationStatusResponseDto })
  async verificationStatus(
    @CurrentAuth() auth: AuthContext,
  ): Promise<VerificationStatusResponseDto> {
    return { data: await this.verification.status(auth.userId) };
  }

  @Post('verification/upload-url')
  @RateLimit({ bucket: 'selfie-user', limit: 10, windowSeconds: 86400, key: byUser })
  @ApiOperation({ summary: 'Selfie yükleme adresi al' })
  @ApiCreatedResponse({ type: SelfieUploadResponseDto })
  async selfieUpload(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateSelfieUploadDto,
  ): Promise<SelfieUploadResponseDto> {
    return { data: await this.verification.createUpload(auth.userId, body) };
  }

  @Post('verification/:id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Selfie yüklendi: incelemeye gönder' })
  @ApiOkResponse({ type: VerificationStatusResponseDto })
  async submit(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<VerificationStatusResponseDto> {
    return { data: await this.verification.submit(auth.userId, id) };
  }
}
