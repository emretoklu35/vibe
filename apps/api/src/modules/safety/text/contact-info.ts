/**
 * Metinde uygulama dışına yönlendiren iletişim bilgisi var mı? (R6: dolandırıcılık / romance scam)
 * Mesajda bulunursa mesaj engellenmez, alıcıya uyarı gösterilir; "hakkında" metninde ise reddedilir.
 * Kural tabanlı ve açıklanabilir; yanlış pozitifi düşük tutmak için yalnızca net kalıplar aranır.
 */
export type ContactKind = 'url' | 'email' | 'phone' | 'iban' | 'handle';

const PATTERNS: [ContactKind, RegExp][] = [
  [
    'url',
    /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|me|app|link|ly|co|tr)(?:\/\S*)?\b/i,
  ],
  ['email', /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/i],
  // TR IBAN: TR + 24 hane (boşluklu yazım dahil)
  ['iban', /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/i],
  // "@kullanici" veya "insta: kullanici" gibi sosyal medya yönlendirmeleri
  [
    'handle',
    /(?:^|\s)@[a-z0-9_.]{3,30}\b|\b(?:insta(?:gram)?|ig|snap(?:chat)?|telegram|tg|whatsapp|wp|twitter|tiktok)\s*[:=]?\s*@?[a-z0-9_.]{3,30}\b/i,
  ],
];

/** Rakamları ayıklayıp telefon gibi görünen 10+ haneli dizileri yakalar ("0532 123 45 67", "5321234567"). */
function containsPhone(text: string): boolean {
  const candidates = text.match(/(?:\+?\d[\d\s().-]{8,}\d)/g) ?? [];
  return candidates.some((c) => {
    const digits = c.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13;
  });
}

export function detectContactInfo(text: string): ContactKind[] {
  const found = new Set<ContactKind>();
  for (const [kind, pattern] of PATTERNS) {
    if (pattern.test(text)) found.add(kind);
  }
  // IBAN rakamları telefon olarak da sayılmasın
  if (!found.has('iban') && containsPhone(text)) found.add('phone');
  return [...found];
}
