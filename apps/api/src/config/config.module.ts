import { Global, Module } from '@nestjs/common';

import { parseEnv, type AppConfig } from './env.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: (): AppConfig => parseEnv(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
