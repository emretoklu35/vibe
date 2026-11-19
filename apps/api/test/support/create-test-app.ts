import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';
import { FixturesController } from './fixtures.controller.js';

type Override = { token: unknown; useValue: unknown };

export async function createTestApp(overrides: Override[] = []): Promise<NestExpressApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: [FixturesController],
  });
  for (const { token, useValue } of overrides) {
    builder = builder.overrideProvider(token as never).useValue(useValue);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();
  return app;
}
