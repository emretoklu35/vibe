import { HttpStatus } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

/** (zaman, id) çiftiyle anahtar tabanlı sayfalama imleci. */
export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`).toString('base64url');
}

export function decodeCursor(cursor?: string): { at: Date; id: string } | undefined {
  if (!cursor) return undefined;
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const at = new Date(iso ?? '');
  if (!id || Number.isNaN(at.getTime()) || !/^[0-9a-f-]{36}$/.test(id)) {
    throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, 'Geçersiz sayfa imleci');
  }
  return { at, id };
}
