import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';
import { SMS_SENDER } from '../../src/modules/auth/sms/sms-sender.js';
import { FixturesController } from './fixtures.controller.js';
import { SmsCapture } from './sms-capture.js';

type Override = { token: unknown; useValue: unknown };

export async function createTestApp(overrides: Override[] = []): Promise<NestExpressApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: [FixturesController],
  });
  // SMS hiçbir testte gerçekten gönderilmez; kodlar SmsCapture'dan okunur.
  builder = builder.overrideProvider(SMS_SENDER).useValue(new SmsCapture());
  for (const { token, useValue } of overrides) {
    builder = builder.overrideProvider(token as never).useValue(useValue);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();
  return app;
}
