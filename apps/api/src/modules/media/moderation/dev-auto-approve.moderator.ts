import { Injectable } from '@nestjs/common';

import type { ImageModerator, ModerationResult } from './image-moderator.js';

/**
 * YALNIZCA GELİŞTİRME: her görseli onaylar. production'da seçilemez (env.ts — MODERATION_PROVIDER).
 */
@Injectable()
export class DevAutoApproveModerator implements ImageModerator {
  moderate(): Promise<ModerationResult> {
    return Promise.resolve({ decision: 'APPROVED', labels: { provider: 'dev-auto-approve' } });
  }
}
