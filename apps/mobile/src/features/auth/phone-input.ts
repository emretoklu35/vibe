/**
 * Telefon alanı için yalnızca kullanıcı deneyimi yardımcıları. Numaranın geçerliliğine sunucu karar verir
 * (INVALID_PHONE); burada iş kuralı tekrarlanmaz.
 */

/** "5321234567" → "532 123 45 67" (yazarken okunabilirlik için). */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10);
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)];
  return groups.filter(Boolean).join(' ');
}

/** Gönderilecek değer: "+90" + 10 hane. */
export function toApiPhone(display: string): string {
  return `+90${display.replace(/\D/g, '')}`;
}

export function hasTenDigits(display: string): boolean {
  return display.replace(/\D/g, '').length === 10;
}
