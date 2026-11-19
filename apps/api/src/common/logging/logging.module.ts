import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { genReqId } from '../http/request-id.js';
import { REDACTION_CENSOR, REDACT_PATHS } from './redaction.js';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.LOG_LEVEL,
          genReqId,
          redact: { paths: REDACT_PATHS, censor: REDACTION_CENSOR },
          // Sağlık kontrolleri (load balancer her birkaç saniyede bir çağırır) loglanmaz.
          autoLogging: { ignore: (req) => req.url?.includes('/health/') ?? false },
          // Varsayılan serileştiriciler sorgu dizesini de yazar; yalnızca yol ve yöntem loglanır.
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              path: req.url.split('?')[0],
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          transport:
            config.NODE_ENV === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
  ],
})
export class LoggingModule {}
