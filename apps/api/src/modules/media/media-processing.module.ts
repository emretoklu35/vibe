import { Module } from '@nestjs/common';

import { DevAutoApproveModerator } from './moderation/dev-auto-approve.moderator.js';
import { IMAGE_MODERATOR } from './moderation/image-moderator.js';
import { PhotoProcessingService } from './photo-processing.service.js';

/** Worker tarafı: görsel işleme ve denetim. */
@Module({
  providers: [
    PhotoProcessingService,
    // MODERATION_PROVIDER şimdilik yalnızca "dev-auto-approve" (env.ts production'da reddeder).
    // Gerçek sağlayıcı eklendiğinde config'e göre seçilecek.
    { provide: IMAGE_MODERATOR, useClass: DevAutoApproveModerator },
  ],
  exports: [PhotoProcessingService],
})
export class MediaProcessingModule {}
