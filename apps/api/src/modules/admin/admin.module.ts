import { Module } from '@nestjs/common';

import { SessionsModule } from '../auth/sessions.module.js';
import { AdminAuthController, AdminController } from './admin.controller.js';
import { AuditService } from './audit.service.js';
import { AdminAuthService } from './auth/admin-auth.service.js';
import { AdminGuard } from './auth/admin.guard.js';
import { ModerationService } from './moderation.service.js';

@Module({
  imports: [SessionsModule],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminGuard, AuditService, ModerationService],
  exports: [AuditService],
})
export class AdminModule {}
