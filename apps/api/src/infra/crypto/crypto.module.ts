import { Global, Module } from '@nestjs/common';

import { PhoneCryptoService } from './phone-crypto.service.js';
import { SecretBoxService } from './secret-box.service.js';

@Global()
@Module({
  providers: [PhoneCryptoService, SecretBoxService],
  exports: [PhoneCryptoService, SecretBoxService],
})
export class CryptoModule {}
