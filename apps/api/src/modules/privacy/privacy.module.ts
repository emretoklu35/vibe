import { Module } from '@nestjs/common';

import { ConsentsService } from './consents.service.js';
import { DataExportService } from './data-export.service.js';
import { LegalController } from './legal.controller.js';
import { PrivacyController } from './privacy.controller.js';

@Module({
  controllers: [LegalController, PrivacyController],
  providers: [ConsentsService, DataExportService],
  exports: [ConsentsService],
})
export class PrivacyModule {}
