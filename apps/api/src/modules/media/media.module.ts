import { Module } from '@nestjs/common';

import { PhotosController } from './photos.controller.js';
import { PhotosService } from './photos.service.js';

/** API tarafı: yükleme adresi, tamamlama, listeleme, sıralama, silme. İşleme worker'dadır. */
@Module({ controllers: [PhotosController], providers: [PhotosService], exports: [PhotosService] })
export class MediaModule {}
