import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/api/client';

type FieldError = { field: string; messages: string[] };

/**
 * Sunucunun VALIDATION_FAILED ayrıntılarını form alanlarına yazar.
 * Doğrulama kuralları tek yerde (API) kalır; istemci yalnızca hatayı doğru alanın altında gösterir.
 * Eşleşen alan bulunduysa true döner.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (
    !(error instanceof ApiError) ||
    !(error.code === 'VALIDATION_FAILED' || error.code === 'CONTACT_INFO_NOT_ALLOWED') ||
    !Array.isArray(error.details)
  ) {
    return false;
  }
  const contactInfo = error.code === 'CONTACT_INFO_NOT_ALLOWED';
  let matched = false;
  for (const item of error.details as FieldError[]) {
    const field = fields.find((f) => f === item.field);
    if (field) {
      setError(field, {
        type: 'server',
        message: contactInfo ? CONTACT_INFO_MESSAGE : fieldMessage(item.field),
      });
      matched = true;
    }
  }
  return matched;
}

const FIELD_MESSAGES: Record<string, string> = {
  displayName: 'Adında yalnızca harf, boşluk, kesme ve tire olabilir',
  heightCm: 'Boy 120–230 cm arasında olmalı',
  bio: 'Hakkında en fazla 500 karakter olabilir',
  jobTitle: 'Meslek en fazla 60 karakter olabilir',
  cityName: 'Şehir en fazla 80 karakter olabilir',
  minAge: 'Yaş aralığını kontrol et',
  maxAge: 'Yaş aralığını kontrol et',
};

/** Güvenlik kuralı: iletişim bilgisi yalnızca eşleşme sonrası, kişinin kendi isteğiyle paylaşılır. */
const CONTACT_INFO_MESSAGE =
  'Telefon, e-posta, bağlantı veya sosyal medya hesabı yazamazsın. Bunları eşleştiğin kişiyle sohbette paylaşabilirsin.';

const fieldMessage = (field: string) => FIELD_MESSAGES[field] ?? 'Bu alanı kontrol et';
