import { maskPhone, normalizeTurkishMobile } from './phone.js';

describe('normalizeTurkishMobile', () => {
  it.each([
    '+905321234567',
    '+90 532 123 45 67',
    '0090 532 123 45 67',
    '905321234567',
    '05321234567',
    '0 (532) 123-45-67',
    '5321234567',
    '532.123.45.67',
  ])('%j → +905321234567', (input) => {
    expect(normalizeTurkishMobile(input)).toBe('+905321234567');
  });

  it.each([
    ['sabit hat', '02121234567'],
    ['eksik hane', '053212345'],
    ['fazla hane', '053212345678'],
    ['başka ülke', '+4915112345678'],
    ['harf', '0532abc4567'],
    ['boş', ''],
    ['çok uzun', '0'.repeat(40)],
  ])('%s reddedilir', (_label, input) => {
    expect(normalizeTurkishMobile(input)).toBeUndefined();
  });

  it('string olmayan girdiyi reddeder', () => {
    expect(normalizeTurkishMobile(5321234567)).toBeUndefined();
    expect(normalizeTurkishMobile(undefined)).toBeUndefined();
  });
});

describe('maskPhone', () => {
  it('yalnızca ülke kodu, ilk hane ve son iki haneyi gösterir', () => {
    expect(maskPhone('+905321234567')).toBe('+90 5** *** ** 67');
  });
});
