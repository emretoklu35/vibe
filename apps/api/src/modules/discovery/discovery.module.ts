import { Module } from '@nestjs/common';

import { PrivacyModule } from '../privacy/privacy.module.js';
import { DiscoveryController } from './discovery.controller.js';
import { DiscoveryRepository } from './discovery.repository.js';
import { DiscoveryService } from './discovery.service.js';

@Module({
  imports: [PrivacyModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, DiscoveryRepository],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
