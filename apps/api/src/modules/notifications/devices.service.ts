import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AuthContext } from '../auth/auth.decorators.js';
import type {
  DeviceDto,
  NotificationSettingsDto,
  RegisterDeviceDto,
} from './dto/notifications.dto.js';

export const DEFAULT_SETTINGS: NotificationSettingsDto = { newMatch: true, newMessage: true };

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Token cihazı temsil eder; aynı telefona başka hesap giriş yaparsa sahiplik yeni hesaba geçer
   * (eski hesabın bildirimleri o telefona gitmez). Kayıt oturuma bağlanır: çıkışta silinir.
   */
  async register(auth: AuthContext, input: RegisterDeviceDto): Promise<DeviceDto> {
    const data = {
      userId: auth.userId,
      sessionId: auth.sessionId,
      platform: input.platform,
      appVersion: input.appVersion,
      locale: input.locale,
      lastSeenAt: new Date(),
      disabledAt: null,
    };
    const device = await this.prisma.userDevice.upsert({
      where: { pushToken: input.pushToken },
      create: { ...data, pushToken: input.pushToken },
      update: data,
      select: { id: true, platform: true },
    });
    return device;
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.userDevice.deleteMany({ where: { id, userId } });
    if (count === 0)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Cihaz bulunamadı');
  }

  async getSettings(userId: string): Promise<NotificationSettingsDto> {
    const row = await this.prisma.notificationSettings.findUnique({
      where: { userId },
      select: { newMatch: true, newMessage: true },
    });
    return row ?? DEFAULT_SETTINGS;
  }

  async setSettings(
    userId: string,
    input: NotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      create: { userId, newMatch: input.newMatch, newMessage: input.newMessage },
      update: { newMatch: input.newMatch, newMessage: input.newMessage },
      select: { newMatch: true, newMessage: true },
    });
  }
}
