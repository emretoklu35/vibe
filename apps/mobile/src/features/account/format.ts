const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDate = (iso: string) => dateFormatter.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormatter.format(new Date(iso));

/** Oturum listesinde cihazı tanınır kılmak için kaba bir etiket (ör. "iPhone", "Android"). */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Bilinmeyen cihaz';
  if (/iphone|ios|darwin/i.test(userAgent)) return 'iPhone';
  if (/android|okhttp/i.test(userAgent)) return 'Android';
  if (/mozilla/i.test(userAgent)) return 'Tarayıcı';
  return 'Bilinmeyen cihaz';
}
