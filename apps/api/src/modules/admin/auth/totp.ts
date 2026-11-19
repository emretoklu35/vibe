import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238): HMAC-SHA1, 30 sn adım, 6 hane. Kimlik doğrulama uygulamalarıyla (Google
 * Authenticator, 1Password vb.) uyumlu. Saat kayması için ±1 adım kabul edilir.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): Buffer {
  return randomBytes(20);
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return code.toString().padStart(digits, '0');
}

export function totp(secret: Buffer, atMs = Date.now(), digits = DIGITS): string {
  return hotp(secret, Math.floor(atMs / 1000 / STEP_SECONDS), digits);
}

export function verifyTotp(secret: Buffer, code: string, atMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  return [-1, 0, 1].some((drift) =>
    timingSafeEqual(Buffer.from(hotp(secret, counter + drift)), Buffer.from(code)),
  );
}

export function otpauthUri(secret: Buffer, email: string): string {
  const label = encodeURIComponent(`VIBE Admin:${email}`);
  return `otpauth://totp/${label}?secret=${base32Encode(secret)}&issuer=VIBE%20Admin&algorithm=SHA1&digits=6&period=30`;
}
