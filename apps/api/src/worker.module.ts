import { Module } from '@nestjs/common';

import { LoggingModule } from './common/logging/logging.module.js';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { StorageModule } from './infra/storage/storage.module.js';
import { MaintenanceProcessor } from './jobs/maintenance.processor.js';
import { MediaProcessor } from './jobs/media.processor.js';
import { NotificationsProcessor } from './jobs/notifications.processor.js';
import { PushDeliveryModule } from './modules/notifications/push/push-delivery.module.js';
import { MediaProcessingModule } from './modules/media/media-processing.module.js';
import { AccountDeletionService } from './modules/users/account-deletion.service.js';

/** Arka plan işleri süreci: HTTP sunmaz, yalnızca kuyrukları işler. */
@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    StorageModule,
    MediaProcessingModule,
    PushDeliveryModule,
  ],
  providers: [AccountDeletionService, MaintenanceProcessor, MediaProcessor, NotificationsProcessor],
})
export class WorkerModule {}
