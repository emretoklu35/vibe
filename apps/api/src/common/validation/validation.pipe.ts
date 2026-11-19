import { HttpStatus, ValidationPipe, type ValidationError } from '@nestjs/common';

import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';

export type FieldError = { field: string; messages: string[] };

/** İç içe DTO hatalarını "profile.photos.0.url" biçiminde düz bir listeye çevirir. */
export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own: FieldError[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

/** Bilinmeyen alanları reddeder, tipleri dönüştürür, hataları standart biçimde döndürür. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // Doğrulama hatalarında kullanıcının gönderdiği değer yanıta/loga geri yazılmaz.
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'İstek doğrulanamadı',
        flattenValidationErrors(errors),
      ),
  });
}
