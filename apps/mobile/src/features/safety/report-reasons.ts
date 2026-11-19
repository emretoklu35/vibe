import type { ReportReason, ReportTargetType } from '@vibe/api-contract';

/** Kullanıcıya gösterilen şikayet nedenleri; en ağır olanlar üstte. */
export const REPORT_REASONS: readonly { value: ReportReason; label: string }[] = [
  { value: 'UNDERAGE', label: '18 yaşından küçük olabilir' },
  { value: 'VIOLENCE_THREAT', label: 'Tehdit veya şiddet' },
  { value: 'NUDITY_SEXUAL', label: 'Çıplaklık veya cinsel içerik' },
  { value: 'HARASSMENT', label: 'Taciz veya rahatsız edici davranış' },
  { value: 'HATE', label: 'Nefret söylemi' },
  { value: 'SCAM_SPAM', label: 'Dolandırıcılık, para isteği veya reklam' },
  { value: 'FAKE_PROFILE', label: 'Sahte profil veya başkasının fotoğrafları' },
  { value: 'OFFLINE_BEHAVIOR', label: 'Buluşmada yaşanan bir sorun' },
  { value: 'OTHER', label: 'Başka bir şey' },
];

const SUBJECT: Record<ReportTargetType, string> = {
  PROFILE: 'profilini',
  PHOTO: 'fotoğrafını',
  MESSAGE: 'mesajını',
};

/** "Ayşe adlı kişinin mesajını" gibi şikayet ekranı başlığı. */
export const reportTitle = (name: string | undefined, target: ReportTargetType) =>
  `${name ? `${name} adlı kişinin ` : 'Bu kişinin '}${SUBJECT[target]}`;

/** Yalnızca bilinen hedef türleri kabul edilir (yönlendirme parametresi dışarıdan gelir). */
export const parseTargetType = (value: string | undefined): ReportTargetType =>
  value === 'PHOTO' || value === 'MESSAGE' ? value : 'PROFILE';
