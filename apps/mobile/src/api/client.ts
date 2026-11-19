import { API_BASE_URL } from './config';

/** API'nin standart hata gövdesi: { error: { code, message, details? }, requestId }. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Sunucuya hiç ulaşılamadı (ağ yok, zaman aşımı, yanlış adres). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

type ErrorEnvelope = {
  error?: { code?: unknown; message?: unknown; details?: unknown };
  requestId?: unknown;
};

const DEFAULT_TIMEOUT_MS = 10_000;

export type ApiRequestInit = Omit<RequestInit, 'body'> & {
  timeoutMs?: number;
  /** JSON olarak gönderilecek gövde. */
  json?: unknown;
};

export async function apiRequest<T>(path: `/${string}`, init: ApiRequestInit = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, signal, json, ...rest } = init;

  // AbortSignal.timeout/any React Native'de garanti değil; tek bir controller elle yönetilir.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', forwardAbort);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: json === undefined ? undefined : JSON.stringify(json),
      signal: controller.signal,
    });
  } catch (cause) {
    throw new ApiError(
      0,
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      timedOut ? 'Sunucu zamanında yanıt vermedi' : 'Sunucuya ulaşılamadı',
      undefined,
      cause,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }

  // 204 gibi gövdesiz yanıtlar
  const body: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => undefined);

  if (!response.ok) {
    const envelope = (body ?? {}) as ErrorEnvelope;
    throw new ApiError(
      response.status,
      typeof envelope.error?.code === 'string' ? envelope.error.code : 'UNKNOWN_ERROR',
      typeof envelope.error?.message === 'string'
        ? envelope.error.message
        : `Beklenmeyen yanıt (${response.status})`,
      typeof envelope.requestId === 'string' ? envelope.requestId : undefined,
      envelope.error?.details,
    );
  }

  return body as T;
}
