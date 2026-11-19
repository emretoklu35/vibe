import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Dışarıdan gelen kimlik yalnızca güvenli biçimdeyse kabul edilir (log enjeksiyonunu önler). */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function resolveRequestId(incoming: string | string[] | undefined): string {
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

/** pino-http `genReqId`: kimliği belirler ve yanıt başlığına yazar. */
export function genReqId(req: IncomingMessage, res: ServerResponse): string {
  const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}
