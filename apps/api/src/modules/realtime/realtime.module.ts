import { Global, Module } from '@nestjs/common';

import { AccessModule } from '../auth/access.module.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeService } from './realtime.service.js';

@Global()
@Module({
  imports: [AccessModule],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
