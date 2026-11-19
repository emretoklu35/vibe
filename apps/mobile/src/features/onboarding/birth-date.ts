/**
 * "GG.AA.YYYY" girişini biçimler ve API'nin beklediği "YYYY-MM-DD"ye çevirir.
 * Yaş sınırı sunucuda uygulanır (tek doğruluk kaynağı); burada yalnızca takvim geçerliliği kontrol edilir.
 */

/** Yazarken noktaları otomatik ekler: "23041995" → "23.04.1995". */
export function formatBirthDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('.');
}

/** Geçerli bir takvim tarihiyse "YYYY-MM-DD", değilse undefined. */
export function toIsoBirthDate(display: string): string | undefined {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(display);
  if (!match) return undefined;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day ||
    year < 1900
  ) {
    return undefined;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}
