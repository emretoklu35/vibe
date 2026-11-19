import { Module } from '@nestjs/common';

import { SessionsModule } from '../auth/sessions.module.js';
import { PrivacyModule } from '../privacy/privacy.module.js';
import { AccountDeletionService } from './account-deletion.service.js';
import { RegistrationBlockService } from './registration-block.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [SessionsModule, PrivacyModule],
  controllers: [UsersController],
  providers: [UsersService, RegistrationBlockService, AccountDeletionService],
  exports: [UsersService, RegistrationBlockService, AccountDeletionService],
})
export class UsersModule {}
