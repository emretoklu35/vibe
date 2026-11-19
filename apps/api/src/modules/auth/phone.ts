/**
 * Türkiye cep telefonu numarasını E.164'e (+905XXXXXXXXX) çevirir.
 * Lansman Türkiye ile sınırlı (K4); diğer ülkeler eklendiğinde libphonenumber değerlendirilecek.
 * Kabul edilen yazımlar: "+90 532 123 45 67", "0090...", "90532...", "0532 123 45 67", "532-123-45-67".
 */
export function normalizeTurkishMobile(input: unknown): string | undefined {
  if (typeof input !== 'string' || input.length > 32) return undefined;
  if (!/^[\d\s()+.-]+$/.test(input)) return undefined;

  let digits = input.replace(/\D/g, '');
  if (input.trim().startsWith('+')) {
    if (!digits.startsWith('90')) return undefined;
    digits = digits.slice(2);
  } else if (digits.startsWith('0090')) {
    digits = digits.slice(4);
  } else if (digits.length === 12 && digits.startsWith('90')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return /^5\d{9}$/.test(digits) ? `+90${digits}` : undefined;
}

/** Loglar için: "+90 5** *** ** 67". */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 3)} ${e164[3]}** *** ** ${e164.slice(-2)}`;
}
