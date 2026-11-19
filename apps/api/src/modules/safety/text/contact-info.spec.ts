import { detectContactInfo } from './contact-info.js';

describe('detectContactInfo', () => {
  it.each([
    ['Numaram 0532 123 45 67', ['phone']],
    ['+90 532 1234567 yaz bana', ['phone']],
    ['bana wp den yaz 5321234567', expect.arrayContaining(['phone', 'handle'])],
    ['insta: deniz.ece', ['handle']],
    ['@denizece hesabıma bak', ['handle']],
    ['https://bit.ly/x tıkla', ['url']],
    ['siteme bak: ornek.com', ['url']],
    ['mail at: ece@example.com', expect.arrayContaining(['email'])],
    ['IBAN TR33 0006 1005 1978 6457 8413 26 gönder', ['iban']],
  ])('%j → %j', (text, expected) => {
    expect(detectContactInfo(text)).toEqual(expected);
  });

  it.each([
    'Selam, nasılsın?',
    'Saat 19:30 gibi Kadıköy’de buluşalım mı?',
    '2024 yılında 3 kez gittim',
    'Boyum 172, 1995 doğumluyum',
    'Fiyatı 1.250 TL idi',
  ])('normal metin işaretlenmez: %j', (text) => {
    expect(detectContactInfo(text)).toEqual([]);
  });
});
