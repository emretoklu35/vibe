import { type INestApplication, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';
import { createValidationPipe } from './common/validation/validation.pipe.js';
import { APP_CONFIG } from './config/config.module.js';
import type { AppConfig } from './config/env.js';

export const API_PREFIX = 'api';
export const SWAGGER_PATH = 'api/docs';

/**
 * HTTP katmanının tüm ortak ayarları. main.ts ve e2e testleri aynı fonksiyonu kullanır,
 * böylece testler production ile aynı davranışı doğrular.
 */
export function configureApp(app: NestExpressApplication): AppConfig {
  const config = app.get<AppConfig>(APP_CONFIG);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(
    helmet({
      // Swagger UI satır içi script kullanır; CSP yalnızca Swagger açıkken gevşetilir (production'da kapalı).
      contentSecurityPolicy: config.SWAGGER_ENABLED ? false : undefined,
    }),
  );
  if (config.CORS_ORIGINS.length > 0) {
    app.enableCors({
      origin: config.CORS_ORIGINS,
      exposedHeaders: [
        'x-request-id',
        'RateLimit-Limit',
        'RateLimit-Remaining',
        'RateLimit-Reset',
        'Retry-After',
      ],
    });
  }
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (config.SWAGGER_ENABLED) setupSwagger(app);
  return config;
}

export function buildOpenApiDocument(app: INestApplication) {
  const document = new DocumentBuilder()
    .setTitle('VIBE API')
    .setDescription('VIBE mobil uygulaması için REST API')
    .setVersion('1')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, document);
}

function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, () => buildOpenApiDocument(app));
}
