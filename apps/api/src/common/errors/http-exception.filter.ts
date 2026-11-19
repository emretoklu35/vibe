import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { REQUEST_ID_HEADER, resolveRequestId } from '../http/request-id.js';
import { AppException } from './app.exception.js';
import { ErrorCode, errorCodeForStatus } from './error-codes.js';
import type { ErrorResponseDto } from './error-response.dto.js';

/** Nest, express body-parser'ın JSON hatasını `cause` olarak taşıyan BadRequestException'a çevirir. */
function isJsonParseError(exception: HttpException): boolean {
  const cause: unknown = exception.cause;
  return (
    cause instanceof SyntaxError &&
    (cause as SyntaxError & { type?: string }).type === 'entity.parse.failed'
  );
}

/**
 * Tüm hataları tek biçime çevirir: { error: { code, message, details? }, requestId }.
 * 5xx hatalarının iç ayrıntıları istemciye sızdırılmaz, yalnızca loglanır.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    // Gövde ayrıştırma gibi erken hatalar istek-kimliği middleware'inden önce oluşabilir.
    // genReqId her zaman string üretir (bkz. request-id.ts).
    const requestId =
      typeof request.id === 'string'
        ? request.id
        : resolveRequestId(request.headers[REQUEST_ID_HEADER]);
    if (!response.headersSent) response.setHeader(REQUEST_ID_HEADER, requestId);

    const { status, body } = this.toErrorBody(exception);

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId, path: request.path },
        'Beklenmeyen sunucu hatası',
      );
    }

    const payload: ErrorResponseDto = { error: body, requestId };
    response.status(status).json(payload);
  }

  private toErrorBody(exception: unknown): {
    status: number;
    body: ErrorResponseDto['error'];
  } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: {
          code: exception.code,
          message: exception.message,
          ...(exception.details === undefined ? {} : { details: exception.details }),
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        body: {
          code: errorCodeForStatus(status),
          message:
            status >= 500
              ? 'Beklenmeyen bir hata oluştu'
              : isJsonParseError(exception)
                ? 'İstek gövdesi geçerli JSON değil'
                : exception.message,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: ErrorCode.INTERNAL_ERROR, message: 'Beklenmeyen bir hata oluştu' },
    };
  }
}
