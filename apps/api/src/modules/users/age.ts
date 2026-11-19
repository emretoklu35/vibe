export const MINIMUM_AGE = 18;
export const MAXIMUM_AGE = 100;
const TIME_ZONE = 'Europe/Istanbul';

export type CalendarDate = { year: number; month: number; day: number };

/** "YYYY-MM-DD" → takvim tarihi. Var olmayan tarihleri (31 Şubat gibi) reddeder. */
export function parseCalendarDate(value: string): CalendarDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return undefined;
  }
  return { year, month, day };
}

/** Türkiye saatine göre "bugün". Gece yarısı UTC farkı yüzünden yaş bir gün erken/geç hesaplanmasın. */
export function todayInTurkey(now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/**
 * Tam yaş. 29 Şubat doğumlular artık olmayan yıllarda 1 Mart'ta yaş alır
 * (ay/gün karşılaştırması bunu doğal olarak sağlar).
 */
export function ageOn(birth: CalendarDate, today: CalendarDate): number {
  const hadBirthday =
    today.month > birth.month || (today.month === birth.month && today.day >= birth.day);
  return today.year - birth.year - (hadBirthday ? 0 : 1);
}

export function toCalendarDate(date: Date): CalendarDate {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function formatCalendarDate({ year, month, day }: CalendarDate): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
