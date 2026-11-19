import { DUMMY_HASH, hashPassword, verifyPassword } from './password.js';

describe('argon2id parola özeti', () => {
  it('doğru parolayı kabul eder, yanlışı reddeder; her özet farklı tuz kullanır', async () => {
    const a = await hashPassword('çok-gizli-parola-123');
    const b = await hashPassword('çok-gizli-parola-123');
    expect(a.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    expect(a).not.toBe(b);
    expect(await verifyPassword('çok-gizli-parola-123', a)).toBe(true);
    expect(await verifyPassword('yanlış', a)).toBe(false);
  });

  it('bozuk veya sahte özet her zaman reddedilir', async () => {
    expect(await verifyPassword('x', 'düz-metin')).toBe(false);
    expect(await verifyPassword('x', DUMMY_HASH)).toBe(false);
  });
});
