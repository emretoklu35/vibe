import { Module } from '@nestjs/common';

import { AccessAuthenticator } from './access-authenticator.js';
import { TokensService } from './tokens.service.js';

/** Token üretme/doğrulama. Oturum yönetiminden ayrıdır; WebSocket katmanı yalnızca bunu kullanır. */
@Module({
  providers: [TokensService, AccessAuthenticator],
  exports: [TokensService, AccessAuthenticator],
})
export class AccessModule {}
