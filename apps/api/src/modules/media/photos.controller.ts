import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { type AuthContext, CurrentAuth } from '../auth/auth.decorators.js';
import {
  CreatePhotoUploadDto,
  PhotoResponseDto,
  PhotosResponseDto,
  PhotoUploadResponseDto,
  ReorderPhotosDto,
} from './dto/photos.dto.js';
import { PhotosService } from './photos.service.js';

const byUser = (req: { auth?: AuthContext }) => req.auth?.userId;

@ApiTags('photos')
@ApiBearerAuth()
@Controller('profiles/me/photos')
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get()
  @ApiOperation({ summary: 'Kendi fotoğrafların (durumlarıyla)' })
  @ApiOkResponse({ type: PhotosResponseDto })
  async list(@CurrentAuth() auth: AuthContext): Promise<PhotosResponseDto> {
    return { data: await this.photos.list(auth.userId) };
  }

  @Post('upload-url')
  @RateLimit({ bucket: 'photo-upload-user', limit: 30, windowSeconds: 3600, key: byUser })
  @ApiOperation({
    summary: 'Fotoğraf yükleme adresi al',
    description:
      'Dönen uploadUrl adresine dosyayı uploadHeaders ile PUT edin, ardından /complete çağırın. Dosya API üzerinden geçmez.',
  })
  @ApiCreatedResponse({ type: PhotoUploadResponseDto })
  async createUpload(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreatePhotoUploadDto,
  ): Promise<PhotoUploadResponseDto> {
    return { data: await this.photos.createUpload(auth.userId, body) };
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yükleme bitti: fotoğraf işlenmeye (EXIF temizleme + denetim) alınır' })
  @ApiOkResponse({ type: PhotoResponseDto })
  async complete(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PhotoResponseDto> {
    return { data: await this.photos.completeUpload(auth.userId, id) };
  }

  @Patch('order')
  @ApiOperation({ summary: 'Fotoğrafları sırala (ilk = ana fotoğraf)' })
  @ApiOkResponse({ type: PhotosResponseDto })
  async reorder(
    @CurrentAuth() auth: AuthContext,
    @Body() body: ReorderPhotosDto,
  ): Promise<PhotosResponseDto> {
    return { data: await this.photos.reorder(auth.userId, body.photoIds) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Fotoğrafı sil (depolamadan da silinir)' })
  @ApiNoContentResponse()
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.photos.remove(auth.userId, id);
  }
}
