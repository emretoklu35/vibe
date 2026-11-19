import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { type AuthContext, CurrentAuth, Public } from '../auth/auth.decorators.js';
import {
  InterestsResponseDto,
  LocationUpdatedResponseDto,
  MyProfileResponseDto,
  SetInterestsDto,
  UpdateLocationDto,
  UpsertProfileDto,
} from './dto/profile.dto.js';
import { PreferenceResponseDto, SetPreferencesDto } from './dto/preferences.dto.js';
import { ProfilesService } from './profiles.service.js';

const byUser = (req: { auth?: AuthContext }) => req.auth?.userId;

@ApiTags('profiles')
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('interests')
  @Public()
  @ApiOperation({ summary: 'İlgi alanı kataloğu' })
  @ApiOkResponse({ type: InterestsResponseDto })
  async interests(): Promise<InterestsResponseDto> {
    return { data: await this.profiles.listInterests() };
  }

  @Get('profiles/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kendi profilin ve ilgi alanların' })
  @ApiOkResponse({ type: MyProfileResponseDto })
  async me(@CurrentAuth() auth: AuthContext): Promise<MyProfileResponseDto> {
    return { data: await this.profiles.getMine(auth.userId) };
  }

  @Put('profiles/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profili oluştur / güncelle' })
  @ApiOkResponse({ type: MyProfileResponseDto })
  async upsert(
    @CurrentAuth() auth: AuthContext,
    @Body() body: UpsertProfileDto,
  ): Promise<MyProfileResponseDto> {
    await this.profiles.upsert(auth.userId, body);
    return { data: await this.profiles.getMine(auth.userId) };
  }

  @Put('profiles/me/interests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'İlgi alanlarını ayarla (en fazla 10)' })
  @ApiOkResponse({ type: MyProfileResponseDto })
  async setInterests(
    @CurrentAuth() auth: AuthContext,
    @Body() body: SetInterestsDto,
  ): Promise<MyProfileResponseDto> {
    await this.profiles.setInterests(auth.userId, body.interestIds);
    return { data: await this.profiles.getMine(auth.userId) };
  }

  @Get('profiles/me/preferences')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Keşfet tercihleri (henüz kaydedilmediyse null)' })
  @ApiOkResponse({ type: PreferenceResponseDto })
  async preferences(@CurrentAuth() auth: AuthContext): Promise<PreferenceResponseDto> {
    return { data: await this.profiles.getPreferences(auth.userId) };
  }

  @Put('profiles/me/preferences')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Keşfet tercihlerini kaydet',
    description:
      'seekingGenders doluysa SPECIAL_CATEGORY_ORIENTATION rızası gerekir (aksi halde 403 CONSENT_REQUIRED).',
  })
  @ApiOkResponse({ type: PreferenceResponseDto })
  async setPreferences(
    @CurrentAuth() auth: AuthContext,
    @Body() body: SetPreferencesDto,
  ): Promise<PreferenceResponseDto> {
    return { data: await this.profiles.setPreferences(auth.userId, body) };
  }

  @Put('profiles/me/location')
  @ApiBearerAuth()
  // Konumu sık değiştirerek mesafe ölçme (trilateration) zorlaşsın.
  @RateLimit({ bucket: 'location-user', limit: 6, windowSeconds: 3600, key: byUser })
  @ApiOperation({
    summary: 'Konumu güncelle',
    description:
      'Koordinat bulanıklaştırılarak saklanır (≈1 km ızgara + sabit sapma); yanıtta koordinat dönmez.',
  })
  @ApiOkResponse({ type: LocationUpdatedResponseDto })
  async location(
    @CurrentAuth() auth: AuthContext,
    @Body() body: UpdateLocationDto,
  ): Promise<LocationUpdatedResponseDto> {
    return { data: { locationUpdatedAt: await this.profiles.updateLocation(auth.userId, body) } };
  }
}
