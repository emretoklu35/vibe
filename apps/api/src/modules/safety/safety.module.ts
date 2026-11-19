import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module.js';
import { BlocksController } from './blocks.controller.js';
import { BlocksService } from './blocks.service.js';
import { ReportsService } from './reports.service.js';
import { SafetyController } from './safety.controller.js';
import { VerificationService } from './verification.service.js';

@Module({
  imports: [ChatModule],
  controllers: [BlocksController, SafetyController],
  providers: [BlocksService, ReportsService, VerificationService],
  exports: [BlocksService],
})
export class SafetyModule {}
