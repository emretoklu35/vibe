import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';
import { SMS_SENDER } from '../../src/modules/auth/sms/sms-sender.js';
import { MediaProcessingModule } from '../../src/modules/media/media-processing.module.js';
import { PushDeliveryModule } from '../../src/modules/notifications/push/push-delivery.module.js';
import { PUSH_SENDER } from '../../src/modules/notifications/push/push-sender.js';
import { RetentionService } from '../../src/modules/privacy/retention.service.js';
import { FixturesController } from './fixtures.controller.js';
import { PushRecorder } from './push-recorder.js';
import { SmsCapture } from './sms-capture.js';

type Override = { token: unknown; useValue: unknown };

export async function createTestApp(overrides: Override[] = []): Promise<NestExpressApplication> {
  let builder = Test.createTestingModule({
    // Worker tarafındaki servisler de yüklenir (fotoğraf işleme, push); testler işi kuyruk yerine doğrudan çalıştırır.
    imports: [AppModule, MediaProcessingModule, PushDeliveryModule],
    controllers: [FixturesController],
    // Worker'daki periyodik işler testlerde doğrudan çağrılır.
    providers: [RetentionService],
  });
  // SMS hiçbir testte gerçekten gönderilmez; kodlar SmsCapture'dan okunur.
  builder = builder.overrideProvider(SMS_SENDER).useValue(new SmsCapture());
  builder = builder.overrideProvider(PUSH_SENDER).useValue(new PushRecorder());
  for (const { token, useValue } of overrides) {
    builder = builder.overrideProvider(token as never).useValue(useValue);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  await configureApp(app);
  await app.init();
  return app;
}
