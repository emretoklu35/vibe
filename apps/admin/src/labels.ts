import type { AdminRole, ReportReason, ReportStatus, ReportTargetType } from '@vibe/api-contract';

export const REASON: Record<ReportReason, string> = {
  UNDERAGE: 'Reşit olmayan',
  VIOLENCE_THREAT: 'Şiddet / tehdit',
  NUDITY_SEXUAL: 'Çıplaklık / cinsel içerik',
  HATE: 'Nefret söylemi',
  HARASSMENT: 'Taciz',
  OFFLINE_BEHAVIOR: 'Buluşmada uygunsuz davranış',
  SCAM_SPAM: 'Dolandırıcılık / spam',
  FAKE_PROFILE: 'Sahte profil',
  OTHER: 'Diğer',
};

export const STATUS: Record<ReportStatus, string> = {
  OPEN: 'Açık',
  IN_REVIEW: 'İnceleniyor',
  ACTION_TAKEN: 'İşlem yapıldı',
  DISMISSED: 'Reddedildi',
};

export const TARGET: Record<ReportTargetType, string> = {
  PROFILE: 'Profil',
  PHOTO: 'Fotoğraf',
  MESSAGE: 'Mesaj',
};

export const ROLE: Record<AdminRole, string> = {
  SUPPORT: 'Destek',
  MODERATOR: 'Moderatör',
  ADMIN: 'Yönetici',
  SUPER_ADMIN: 'Süper yönetici',
};

export const canModerate = (role: AdminRole) => role !== 'SUPPORT';
export const canEnforce = (role: AdminRole) => role === 'ADMIN' || role === 'SUPER_ADMIN';

const dateTime = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDateTime = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : '—');
