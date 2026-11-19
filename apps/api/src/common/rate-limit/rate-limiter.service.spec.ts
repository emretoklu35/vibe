import { rateLimitKey } from './rate-limiter.service.js';

describe('rateLimitKey', () => {
  it('tanımlayıcıyı (ör. telefon) anahtara düz yazmaz', () => {
    const key = rateLimitKey('otp-phone', '+905551112233');
    expect(key.startsWith('rl:otp-phone:')).toBe(true);
    expect(key).not.toContain('5551112233');
  });

  it('aynı girdi için kararlı, farklı girdi için farklıdır', () => {
    expect(rateLimitKey('b', 'x')).toBe(rateLimitKey('b', 'x'));
    expect(rateLimitKey('b', 'x')).not.toBe(rateLimitKey('b', 'y'));
    expect(rateLimitKey('a', 'x')).not.toBe(rateLimitKey('b', 'x'));
  });
});
