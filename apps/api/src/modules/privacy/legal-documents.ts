import type { ConsentType } from '../../generated/prisma/enums.js';

/**
 * Hukuki metin kaydı. Bir metin değiştiğinde sürümü artırılır; zorunlu metinlerde kullanıcı
 * yeni sürümü onaylayana kadar onboarding "CONSENTS" adımına döner.
 *
 * ⚠️ TASLAK: Aşağıdaki metinler hukuki inceleme öncesi yer tutucu niteliğindedir (açık karar #15).
 * Yayın öncesi avukat onaylı metinlerle değiştirilmeli ve sürüm artırılmalıdır.
 */
export type LegalDocument = {
  type: ConsentType;
  version: string;
  required: boolean;
  /** Kullanıcı bu belgeye "onay" mı veriyor, yoksa yalnızca "okudum" mu diyor. */
  kind: 'acknowledgement' | 'consent';
  title: string;
  body: string;
};

const DRAFT_NOTICE =
  '> **TASLAK** — Bu metin hukuki inceleme sürecindedir ve yayından önce değiştirilecektir.\n\n';

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  {
    type: 'PRIVACY_NOTICE_ACK',
    version: 'privacy-notice-tr-2026-11-draft1',
    required: true,
    kind: 'acknowledgement',
    title: 'KVKK Aydınlatma Metni',
    body:
      DRAFT_NOTICE +
      [
        '**Veri sorumlusu:** VIBE (unvan ve adres yayın öncesi eklenecek).',
        '',
        '**İşlenen veriler:** Telefon numaranız (şifreli olarak), doğum tarihiniz, uygulamada paylaştığınız profil bilgileri, eşleşme ve mesajlaşma verileriniz, cihaz ve oturum bilgileriniz.',
        '',
        '**Amaçlar:** Hesabınızı oluşturmak ve güvenliğini sağlamak, 18 yaş sınırını uygulamak, eşleşme ve mesajlaşma hizmetini sunmak, kötüye kullanımı önlemek ve yasal yükümlülükleri yerine getirmek.',
        '',
        '**Hukuki sebepler:** Sözleşmenin kurulması ve ifası, hukuki yükümlülük, meşru menfaat; özel nitelikli veriler için ayrıca açık rızanız.',
        '',
        '**Haklarınız:** KVKK m.11 kapsamında verilerinize erişme, düzeltme, silme ve itiraz haklarına sahipsiniz. Hesabınızı uygulama içinden silebilirsiniz.',
      ].join('\n'),
  },
  {
    type: 'TERMS_OF_SERVICE',
    version: 'terms-tr-2026-11-draft1',
    required: true,
    kind: 'consent',
    title: 'Kullanım Koşulları',
    body:
      DRAFT_NOTICE +
      [
        '- VIBE yalnızca 18 yaş ve üzeri kişiler içindir.',
        '- Gerçek kimliğinizi yansıtan bilgiler paylaşmayı, başkalarına saygılı davranmayı ve topluluk kurallarına uymayı kabul edersiniz.',
        '- Taciz, nefret söylemi, dolandırıcılık ve uygunsuz içerik yasaktır; ihlal halinde hesabınız askıya alınabilir veya kapatılabilir.',
        '- Hesabınızı istediğiniz zaman silebilirsiniz.',
      ].join('\n'),
  },
  {
    type: 'SPECIAL_CATEGORY_ORIENTATION',
    version: 'orientation-tr-2026-11-draft1',
    required: false,
    kind: 'consent',
    title: 'Aradığın Kişilere İlişkin Açık Rıza',
    body:
      DRAFT_NOTICE +
      [
        'Keşfet ve eşleşme hizmetini sunabilmek için hangi cinsiyetten kişilerle tanışmak istediğini işlememiz gerekir. Bu bilgi, KVKK m.6 kapsamında **özel nitelikli kişisel veri** (cinsel hayata ilişkin) sayılabileceğinden yalnızca açık rızanla işlenir.',
        '',
        '- Bu bilgi yalnızca sana uygun kişileri göstermek ve seni uygun kişilere göstermek için kullanılır.',
        '- Profilinde başkalarına gösterilmez.',
        '- Rızanı istediğin zaman geri alabilirsin; bu durumda tercihin silinir ve keşfet/eşleşme durur.',
        '- Rıza vermezsen profilini oluşturabilirsin, ancak keşfet ve eşleşme kullanılamaz.',
      ].join('\n'),
  },
  {
    type: 'MARKETING_NOTIFICATIONS',
    version: 'marketing-tr-2026-11-draft1',
    required: false,
    kind: 'consent',
    title: 'Kampanya ve Duyuru Bildirimleri',
    body:
      DRAFT_NOTICE +
      'Yeni özellikler ve kampanyalar hakkında bildirim almayı kabul ediyorum. Bu izni istediğim zaman geri alabilirim. Eşleşme ve mesaj bildirimleri bu izinden bağımsızdır.',
  },
];

export function findLegalDocument(type: ConsentType): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.type === type);
}

export const REQUIRED_DOCUMENTS = LEGAL_DOCUMENTS.filter((doc) => doc.required);
