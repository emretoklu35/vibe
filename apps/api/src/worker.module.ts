import { Module } from '@nestjs/common';

import { LoggingModule } from './common/logging/logging.module.js';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { MaintenanceProcessor } from './jobs/maintenance.processor.js';
import { AccountDeletionService } from './modules/users/account-deletion.service.js';

/** Arka plan işleri süreci: HTTP sunmaz, yalnızca kuyrukları işler. */
@Module({
  imports: [ConfigModule, LoggingModule, PrismaModule],
  providers: [AccountDeletionService, MaintenanceProcessor],
})
export class WorkerModule {}
