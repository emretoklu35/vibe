import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { SessionsModule } from './sessions.module.js';
import { ConsoleSmsSender } from './sms/console-sms.sender.js';
import { SMS_SENDER } from './sms/sms-sender.js';

@Module({
  imports: [SessionsModule, UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    // SMS_PROVIDER şimdilik yalnızca "console" (env.ts production'da reddeder). Gerçek sağlayıcı
    // eklendiğinde burada config'e göre seçilecek.
    { provide: SMS_SENDER, useClass: ConsoleSmsSender },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
