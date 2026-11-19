import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const argon2Async = promisify(argon2);

/** OWASP önerisi (argon2id): 19 MiB bellek, 2 tur, paralellik 1. */
const PARAMS = { memory: 19_456, passes: 2, parallelism: 1, tagLength: 32 } as const;

const PREFIX = '$argon2id$v=19$';

/** Biçim: $argon2id$v=19$m=19456,t=2,p=1$<tuz>$<özet> (base64url, dolgusuz) */
export async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const hash = await argon2Async('argon2id', { message: password, nonce, ...PARAMS });
  const params = `m=${PARAMS.memory},t=${PARAMS.passes},p=${PARAMS.parallelism}`;
  return [PREFIX + params, nonce.toString('base64url'), hash.toString('base64url')].join('$');
}

const ENCODED = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([\w-]+)\$([\w-]+)$/;

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const match = ENCODED.exec(encoded);
  if (!match) return false;
  const [, memory, passes, parallelism, salt, expected] = match;
  const expectedBuf = Buffer.from(expected!, 'base64url');
  const actual = await argon2Async('argon2id', {
    message: password,
    nonce: Buffer.from(salt!, 'base64url'),
    memory: Number(memory),
    passes: Number(passes),
    parallelism: Number(parallelism),
    tagLength: expectedBuf.length,
  });
  return actual.length === expectedBuf.length && timingSafeEqual(actual, expectedBuf);
}

/**
 * Bilinmeyen e-posta ile giriş denemesinde de aynı süre harcansın diye kullanılan sabit özet
 * (hesabın var olup olmadığı yanıt süresinden anlaşılmasın).
 */
export const DUMMY_HASH = [
  PREFIX + 'm=19456,t=2,p=1',
  'AAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
].join('$');
