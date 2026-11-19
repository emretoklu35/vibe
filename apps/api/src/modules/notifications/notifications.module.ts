import { Module } from '@nestjs/common';

import { DevicesService } from './devices.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, DevicesService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
