import { formatPhoneInput, hasTenDigits, toApiPhone } from '../phone-input';

describe('telefon girişi', () => {
  it('yazarken gruplar ve baştaki 0’ı atar', () => {
    expect(formatPhoneInput('05321234567')).toBe('532 123 45 67');
    expect(formatPhoneInput('5321')).toBe('532 1');
  });

  it('API’ye +90 ile gönderir', () => {
    expect(toApiPhone('532 123 45 67')).toBe('+905321234567');
  });

  it('10 hane kontrolü', () => {
    expect(hasTenDigits('532 123 45 67')).toBe(true);
    expect(hasTenDigits('532 123 45')).toBe(false);
  });
});
