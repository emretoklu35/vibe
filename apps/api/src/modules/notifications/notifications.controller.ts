import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { type AuthContext, CurrentAuth } from '../auth/auth.decorators.js';
import { DevicesService } from './devices.service.js';
import {
  DeviceResponseDto,
  NotificationSettingsDto,
  NotificationSettingsResponseDto,
  RegisterDeviceDto,
} from './dto/notifications.dto.js';

const byUser = (req: { auth?: AuthContext }) => req.auth?.userId;

@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly devices: DevicesService) {}

  @Post('devices')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ bucket: 'device-user', limit: 20, windowSeconds: 3600, key: byUser })
  @ApiOperation({ summary: 'Push bildirimi için cihazı kaydet (oturuma bağlı; çıkışta silinir)' })
  @ApiOkResponse({ type: DeviceResponseDto })
  async register(
    @CurrentAuth() auth: AuthContext,
    @Body() body: RegisterDeviceDto,
  ): Promise<DeviceResponseDto> {
    return { data: await this.devices.register(auth, body) };
  }

  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cihaz kaydını sil' })
  @ApiNoContentResponse()
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.devices.remove(auth.userId, id);
  }

  @Get('notifications/settings')
  @ApiOperation({ summary: 'Bildirim tercihleri' })
  @ApiOkResponse({ type: NotificationSettingsResponseDto })
  async settings(@CurrentAuth() auth: AuthContext): Promise<NotificationSettingsResponseDto> {
    return { data: await this.devices.getSettings(auth.userId) };
  }

  @Put('notifications/settings')
  @ApiOperation({ summary: 'Bildirim tercihlerini kaydet' })
  @ApiOkResponse({ type: NotificationSettingsResponseDto })
  async setSettings(
    @CurrentAuth() auth: AuthContext,
    @Body() body: NotificationSettingsDto,
  ): Promise<NotificationSettingsResponseDto> {
    return { data: await this.devices.setSettings(auth.userId, body) };
  }
}
