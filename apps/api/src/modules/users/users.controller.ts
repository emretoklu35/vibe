import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AllowDeletionPending, type AuthContext, CurrentAuth } from '../auth/auth.decorators.js';
import { DeletionResponseDto, MeResponseDto, UpdateMeDto } from './dto/users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @AllowDeletionPending()
  @ApiOperation({ summary: 'Hesap bilgisi ve onboarding adımı' })
  @ApiOkResponse({ type: MeResponseDto })
  async me(@CurrentAuth() auth: AuthContext): Promise<MeResponseDto> {
    return { data: await this.users.getMe(auth.userId) };
  }

  @Patch()
  @ApiOperation({ summary: 'Hesap bilgisini güncelle (şimdilik yalnızca doğum tarihi, bir kez)' })
  @ApiOkResponse({ type: MeResponseDto })
  async update(
    @CurrentAuth() auth: AuthContext,
    @Body() body: UpdateMeDto,
  ): Promise<MeResponseDto> {
    if (body.birthDate !== undefined) await this.users.setBirthDate(auth.userId, body.birthDate);
    return { data: await this.users.getMe(auth.userId) };
  }

  @Delete()
  @AllowDeletionPending()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Hesap silme talebi (30 gün içinde geri alınabilir; tüm oturumlar kapanır)',
  })
  @ApiAcceptedResponse({ type: DeletionResponseDto })
  async requestDeletion(@CurrentAuth() auth: AuthContext): Promise<DeletionResponseDto> {
    return { data: await this.users.requestDeletion(auth.userId) };
  }

  @Post('restore')
  @AllowDeletionPending()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Silme talebini geri al' })
  @ApiNoContentResponse()
  async restore(@CurrentAuth() auth: AuthContext): Promise<void> {
    await this.users.restore(auth.userId);
  }
}
