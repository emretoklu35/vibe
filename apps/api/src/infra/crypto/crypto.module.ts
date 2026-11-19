import { Global, Module } from '@nestjs/common';

import { PhoneCryptoService } from './phone-crypto.service.js';

@Global()
@Module({ providers: [PhoneCryptoService], exports: [PhoneCryptoService] })
export class CryptoModule {}
