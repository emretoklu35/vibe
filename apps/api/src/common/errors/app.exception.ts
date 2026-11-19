import { HttpException, HttpStatus } from '@nestjs/common';

import type { ErrorCode } from './error-codes.js';

/** İş kuralı hataları için: HTTP durumu + sabit hata kodu + isteğe bağlı ayrıntı. */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message, status);
  }
}
