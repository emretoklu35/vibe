/**
 * Fotoğraf denetim sağlayıcısı soyutlaması (K8). Gerçek sağlayıcı (açık karar #12) bu arayüzü uygular.
 * - APPROVED: başkalarına gösterilebilir
 * - REJECTED: kural ihlali (çıplaklık, şiddet vb.) — kullanıcıya gösterilir, keşfette görünmez
 * - NEEDS_REVIEW: emin olunamadı / reşit olmayan şüphesi — moderatör kuyruğuna gider (Faz 6)
 */
export type ModerationDecision = 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW';

export type ModerationResult = {
  decision: ModerationDecision;
  /** Sağlayıcı etiketleri ve skorları; yalnızca inceleme için saklanır. */
  labels: Record<string, unknown>;
};

export interface ImageModerator {
  moderate(image: Buffer): Promise<ModerationResult>;
}

export const IMAGE_MODERATOR = Symbol('IMAGE_MODERATOR');
