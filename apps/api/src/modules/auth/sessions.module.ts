import { Module } from '@nestjs/common';

import { AccessModule } from './access.module.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [AccessModule],
  providers: [SessionsService],
  exports: [SessionsService, AccessModule],
})
export class SessionsModule {}
