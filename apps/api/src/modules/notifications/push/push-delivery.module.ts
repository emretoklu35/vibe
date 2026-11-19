import { Module } from '@nestjs/common';

import { ConsolePushSender } from './console-push.sender.js';
import { PushDeliveryService } from './push-delivery.service.js';
import { PUSH_SENDER } from './push-sender.js';

/** Worker tarafı. PUSH_PROVIDER şimdilik yalnızca "console" (production'da reddedilir, açık karar #11). */
@Module({
  providers: [PushDeliveryService, { provide: PUSH_SENDER, useClass: ConsolePushSender }],
  exports: [PushDeliveryService],
})
export class PushDeliveryModule {}
