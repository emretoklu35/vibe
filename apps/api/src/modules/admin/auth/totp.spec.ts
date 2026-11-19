import { base32Encode, hotp, totp, verifyTotp } from './totp.js';

// RFC 6238 Ek B ve RFC 4226 Ek D: SHA1 gizli anahtarı "12345678901234567890"
const RFC_SECRET = Buffer.from('12345678901234567890');

describe('TOTP (RFC 6238)', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('T=%s → %s (8 hane)', (seconds, expected) => {
    expect(totp(RFC_SECRET, seconds * 1000, 8)).toBe(expected);
  });

  it('RFC 4226 HOTP test vektörleri', () => {
    expect([0, 1, 2, 3].map((c) => hotp(RFC_SECRET, c))).toEqual([
      '755224',
      '287082',
      '359152',
      '969429',
    ]);
  });

  it('±1 adım kabul, daha fazlası reddedilir', () => {
    const now = 1_700_000_000_000;
    const code = totp(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, code, now + 30_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now - 30_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now + 90_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, 'abc123', now)).toBe(false);
  });

  it('base32 (RFC 4648)', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });
});
