import { formatBirthDateInput, toIsoBirthDate } from '../birth-date';

describe('formatBirthDateInput', () => {
  it.each([
    ['2', '2'],
    ['230', '23.0'],
    ['23041995', '23.04.1995'],
    ['23.04.1995999', '23.04.1995'],
    ['ab23-04/1995', '23.04.1995'],
  ])('%j → %j', (input, expected) => {
    expect(formatBirthDateInput(input)).toBe(expected);
  });
});

describe('toIsoBirthDate', () => {
  it('geçerli tarihi ISO biçimine çevirir', () => {
    expect(toIsoBirthDate('23.04.1995')).toBe('1995-04-23');
    expect(toIsoBirthDate('29.02.2004')).toBe('2004-02-29');
  });

  it.each(['30.02.2001', '29.02.2005', '31.04.1995', '23.13.1995', '23.04.95', '01.01.1899'])(
    '%j geçersiz',
    (value) => {
      expect(toIsoBirthDate(value)).toBeUndefined();
    },
  );
});
