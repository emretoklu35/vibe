import { Controller, Get, HttpStatus, Inject, Param, ParseEnumPipe } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ErrorResponseDto } from '../../common/errors/error-response.dto.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { ConsentType } from '../../generated/prisma/enums.js';
import { Public } from '../auth/auth.decorators.js';
import { AppConfigResponseDto, LegalDocumentResponseDto } from './dto/legal.dto.js';
import { findLegalDocument, LEGAL_DOCUMENTS } from './legal-documents.js';

@ApiTags('app')
@Public()
@Controller()
export class LegalController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get('app/config')
  @ApiOperation({ summary: 'Uygulama açılış ayarları: minimum sürüm, hukuki metin sürümleri' })
  @ApiOkResponse({ type: AppConfigResponseDto })
  appConfig(): AppConfigResponseDto {
    return {
      data: {
        minimumAppVersion: this.config.APP_MIN_VERSION,
        legalDocuments: LEGAL_DOCUMENTS.map(({ type, version, required, kind, title }) => ({
          type,
          version,
          required,
          kind,
          title,
        })),
      },
    };
  }

  @Get('legal/documents/:type')
  @ApiOperation({ summary: 'Hukuki metnin güncel sürümü' })
  @ApiOkResponse({ type: LegalDocumentResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  document(
    @Param('type', new ParseEnumPipe(ConsentType)) type: ConsentType,
  ): LegalDocumentResponseDto {
    const doc = findLegalDocument(type);
    if (!doc) throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Metin bulunamadı');
    return { data: doc };
  }
}
