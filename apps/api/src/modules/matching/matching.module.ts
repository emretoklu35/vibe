import { Module } from '@nestjs/common';

import { DiscoveryModule } from '../discovery/discovery.module.js';
import { MatchingController } from './matching.controller.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [DiscoveryModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
