import { ageOn, parseCalendarDate, todayInTurkey } from './age.js';

describe('parseCalendarDate', () => {
  it('geçerli tarihi ayrıştırır', () => {
    expect(parseCalendarDate('1995-04-23')).toEqual({ year: 1995, month: 4, day: 23 });
  });

  it.each(['2001-02-30', '2001-13-01', '2001-00-10', '95-04-23', '1995/04/23', '2000-02-30'])(
    '%j geçersiz',
    (value) => {
      expect(parseCalendarDate(value)).toBeUndefined();
    },
  );

  it('artık yıl 29 Şubat geçerli, artık olmayan yılda geçersiz', () => {
    expect(parseCalendarDate('2004-02-29')).toBeDefined();
    expect(parseCalendarDate('2005-02-29')).toBeUndefined();
  });
});

describe('ageOn', () => {
  const birth = { year: 2008, month: 5, day: 10 };

  it('doğum gününden bir gün önce 17, doğum gününde 18', () => {
    expect(ageOn(birth, { year: 2026, month: 5, day: 9 })).toBe(17);
    expect(ageOn(birth, { year: 2026, month: 5, day: 10 })).toBe(18);
  });

  it('29 Şubat doğumlu, artık olmayan yılda 1 Mart’ta yaş alır', () => {
    const leap = { year: 2008, month: 2, day: 29 };
    expect(ageOn(leap, { year: 2026, month: 2, day: 28 })).toBe(17);
    expect(ageOn(leap, { year: 2026, month: 3, day: 1 })).toBe(18);
  });
});

describe('todayInTurkey', () => {
  it('UTC gece yarısından önce İstanbul’da ertesi gündür (UTC+3)', () => {
    // 2026-05-09 22:30 UTC = 2026-05-10 01:30 İstanbul
    expect(todayInTurkey(new Date('2026-05-09T22:30:00Z'))).toEqual({
      year: 2026,
      month: 5,
      day: 10,
    });
  });
});
