import { ApiError } from '@/api/client';

/** Sunucu mesajları zaten Türkçe ve kullanıcıya yöneliktir; yalnızca birkaç durumda ayrıntı eklenir. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Beklenmeyen bir hata oluştu';
  const details = (error.details ?? {}) as { attemptsLeft?: number; retryAfterSeconds?: number };
  if (error.code === 'OTP_INVALID' && typeof details.attemptsLeft === 'number') {
    return `${error.message} (${details.attemptsLeft} deneme hakkın kaldı)`;
  }
  if (error.code === 'RATE_LIMITED' && typeof details.retryAfterSeconds === 'number') {
    return `${error.message} (${formatWait(details.retryAfterSeconds)})`;
  }
  return error.message;
}

export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} sn`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} dk`;
  return `${Math.ceil(minutes / 60)} saat`;
}
