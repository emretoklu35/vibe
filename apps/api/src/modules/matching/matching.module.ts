import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module.js';
import { DiscoveryModule } from '../discovery/discovery.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { MatchingController } from './matching.controller.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [DiscoveryModule, ChatModule, NotificationsModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
