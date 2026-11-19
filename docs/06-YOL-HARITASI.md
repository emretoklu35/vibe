# 06 — Geliştirme Yol Haritası

Her faz küçük, bağımsız test edilebilir ve şu raporla biter (brief §12): değişen dosyalar · çalıştırılacak komutlar · yapılan testler · sonuçlar · bilinen sınırlamalar · sonraki önerilen iş.

## Bağımlılıklar

```mermaid
flowchart TD
  F0[Faz 0\nPlanlama ✔] --> F1[Faz 1\nTemel altyapı ✔]
  F1 --> F2[Faz 2\nAuth + hesap + rıza ✔]
  F2 --> F3[Faz 3\nProfil + medya + konum ✔]
  F3 --> F4[Faz 4\nKeşfet + eşleşme + engelleme ✔]
  F4 --> F5[Faz 5\nSohbet + push ✔]
  F3 --> F6[Faz 6\nGüvenlik + moderasyon + admin]
  F5 --> F6
  F6 --> F7[Faz 7\nLansman hazırlığı]
  F7 --> MVP((MVP yayını))
  MVP --> F8[Faz 8 Premium/IAP]
  MVP --> F9[Faz 9 AI Matchmaker LLM]
  MVP --> F10[Faz 10 Voice]
  F5 --> F11[Faz 11 Games]
  MVP --> F11
  F5 --> F12[Faz 12 Date Planner]
  MVP --> F12
  F12 --> F13[Faz 13 Double Date]
```

## MVP fazları

### Faz 1 — Temel altyapı ✅ (2026-11-19, onay bekliyor)

- Monorepo (npm workspaces, K5), `packages/config`, kök script'ler, README, `.env.example`.
- `infra/docker-compose.yml`: PostgreSQL 18 + PostGIS, Redis 8.
- API iskeleti: config doğrulama (Zod), Prisma 7 bağlantısı, ilk migration (PostGIS + `Interest`) ve ilgi alanı tohumu, standart hata biçimi, istek kimliği, pino redaksiyonu, Redis tabanlı rate limit, `/health/live|ready`, Swagger, CORS izin listesi.
- Mobil iskelet: Expo SDK 58, Expo Router (`src/app`), tasarım token'ları + temel bileşenler, API istemcisi + TanStack Query, API bağlantı durumu ekranı.
- CI: biçim, lint, typecheck, build, birim + e2e testleri (gerçek PostGIS/Redis), migration drift kontrolü, expo-doctor.
- **Faz 1'den ertelenenler (gerekçe: henüz kullanan kod yok, boş iskelet yazılmadı):**
  - MinIO / S3 → Faz 3 (fotoğraf yükleme ile).
  - BullMQ worker girişi → Faz 2 (hesap silme işi ile).
  - Sentry (API + mobil) → Faz 2 (DSN ve hesap gerektirir).
  - `packages/api-contract` (OpenAPI → TS tipleri) → Faz 2 (ilk gerçek uçlarla; `openapi-typescript` henüz TypeScript 6'yı desteklemiyor, alternatif değerlendirilecek).
  - Mobil birim testleri (jest-expo) → Faz 2 (ilk iş mantığıyla).

### Faz 2 — Auth, hesap, rıza ✅ (2026-11-19, onay bekliyor)

- Telefon OTP (Redis'te HMAC özeti, 5 dk, 5 deneme, tek kullanım), SMS sağlayıcı arayüzü + yalnızca-geliştirme `console` adaptörü (production'da açılış reddedilir).
- Oturumlar: 15 dk JWT (HS256, jose) + opak refresh token (DB'de SHA-256), rotasyon, yeniden kullanımda oturum iptali; global auth guard (oturum ve hesap durumu her istekte DB'den).
- Telefon numarası: HMAC özeti (arama) + AES-256-GCM (geri çözülebilir); düz numara DB'de, logda ve Redis anahtarlarında yok.
- Doğum tarihi + 18 yaş kapısı (Europe/Istanbul); 18 altı beyanında hesap hemen silinir, numara 30 gün kayıt olamaz.
- Rızalar: yalnızca-ekleme `ConsentRecord`, sürümlü hukuki metinler (TASLAK), `/app/config`, `/legal/documents/:type`.
- Hesap silme (30 gün bekleme, geri alma) + BullMQ worker ile kalıcı silme; açık talep başına kısmi unique index.
- `packages/api-contract`: OpenAPI → TS tipleri (`@hey-api/openapi-ts`); CI güncelliğini kontrol eder.
- Mobil: açılış → telefon → kod → doğum tarihi → rızalar → hesap ekranı (oturumlar, çıkış, hesap silme) ve silme bekleyen hesap ekranı; Expo Router `Stack.Protected`, secure-store, tek uçuşlu token yenileme, jest-expo testleri.
- **Testler:** API 59 birim + 58 e2e, mobil 23 birim; akışın tamamı web önizlemede uçtan uca denendi.
- **Ertelenenler:** `UserDevice` / push kaydı → Faz 5 (push ile birlikte). Sentry → Faz 7 (hesap/DSN ve yurt dışı aktarım kararı gerekir). Gerçek SMS sağlayıcı → karar #9 verilince.
- **Bağımlı kararlar:** #9 SMS sağlayıcı (production için zorunlu), #15 hukuki metinler.

### Faz 3 — Profil, medya, konum ✅ (2026-11-19, onay bekliyor)

- Kararlar: K6 cinsiyet seçenekleri, K7 aranan cinsiyet için ayrı açık rıza (yoksa keşfet kapalı), K8 sağlayıcıdan bağımsız denetim, K9 yerel S3 = SeaweedFS.
- Profil (ad, cinsiyet, ilişki beklentisi, hakkında, meslek, boy, şehir, yaşam tarzı, iletişim tarzı, keşfette görünürlük), ilgi alanları (en fazla 10).
- Tercihler: yaş aralığı, mesafe, ilişki beklentisi; aranan cinsiyet yalnızca güncel rıza varken kaydedilir, rıza geri alınınca aynı işlemde silinir.
- Fotoğraf: presigned doğrudan yükleme → worker'da gerçek görsel doğrulama (beyan edilen türe güvenilmez), EXIF/GPS temizleme, 1600 px JPEG, denetim arayüzü (geliştirmede otomatik onay, production'da reddedilir); en fazla 6, sıralama, silme, yarım yüklemelerin temizliği, hesap silmede tüm medyanın silinmesi.
- Konum: ≈1 km ızgara + kullanıcıya özgü sabit sapma; gerçek koordinat saklanmaz/dönmez; saatte 6 güncelleme sınırı; PostGIS GIST index.
- Onboarding: doğum tarihi → rızalar → profil → fotoğraf → tercihler.
- Mobil: profil/fotoğraf/tercih onboarding adımları, profil düzenleme, fotoğraf yönetimi (ana fotoğraf, silme), tercih düzenleme; görseller cihazda JPEG'e çevrilip küçültülerek yüklenir.
- **Testler:** API 70 birim + 88 e2e (gerçek PostGIS + SeaweedFS), mobil 25; onboarding ve düzenleme web önizlemede uçtan uca denendi.
- **Ertelenenler:** Mobilde konum izni ve konum gönderme → Faz 4 (keşfet ekranıyla birlikte; API hazır). Gerçek denetim sağlayıcısı → karar #12. Fotoğraf seçicinin kendisi (işletim sistemi penceresi) otomatik denenemedi; yükleme yolu sayfa içinden aynı API ve S3 çağrılarıyla doğrulandı.

### Faz 4 — Keşfet, eşleşme, engelleme ✅ (2026-11-19, onay bekliyor)

- Keşfet: sert filtreler tek SQL sorgusunda ve **karşılıklı** (cinsiyet, yaş aralığı, mesafe — iki tarafın tercihi de), aktif hesap, görünür profil, onaylı fotoğraf, iki yönlü engel yok; beğenilen, 30 gün içinde geçilen ve eşleşilen (bitmiş dahil) kişiler gelmez.
- Uyum puanı: deterministik, AI'sız saf fonksiyon (ilgi alanı, ilişki beklentisi, yaşam tarzı, iletişim, mesafe, aktiflik); eksik bilgi cezalandırılmaz; gerekçeler "ortak noktalarınız" olarak gösterilir, bilimsel iddia yok.
- Kart: yalnızca onaylı fotoğraflar, yuvarlanmış mesafe ("2 km'den yakın" … "100+ km"); aranan cinsiyet, yaş tercihleri ve koordinat asla dönmez.
- Beğeni yalnızca keşfette görünen kişiye (rastgele kimlikle toplu beğeni/tarama engeli); idempotent; eşzamanlı karşılıklı beğenide advisory lock + sıralı çift unique + CHECK ile tek eşleşme; bitmiş eşleşme yeniden açılmaz.
- Eşleşmeler (imleçli sayfalama), eşleşme ayrıntısı (keşfet filtrelerinden bağımsız), eşleşmeyi bitirme; engelleme (eşleşmeyi aynı işlemde bitirir), engeli kaldırma (eşleşme geri gelmez), engellenenler listesi.
- Mobil: sekmeler (Keşfet, Eşleşmeler, Profil), keşfet eksikleri listesi + konum izni ve paylaşımı (6 saatte bir sessiz güncelleme), kart (fotoğraflar arası dokunarak geçiş, ortak noktalar), beğen/geç/engelle, "Eşleştiniz!" ekranı, eşleşme ayrıntısı, engellenenler.
- **Testler:** API 84 birim + 104 e2e (yarış testi dahil), mobil 25; akış web önizlemede uçtan uca denendi.
- **Bulunan ve düzeltilenler:** korumalı rota grubu klasörüne (/(app)) yönlendiriyordu → her gruba açık `redirectTo`; onboarding ve uygulama ekranlarının aynı URL'ye çözülmesi (`setup-*` adlandırması); "Yakınında" gerekçesinin yuvarlanmış mesafeyle çelişmesi (eşik 3 km).
- **Bilinen sınırlamalar:** Kart kaydırma (swipe) hareketi yok, düğmelerle çalışıyor (erişilebilirlik için de gerekli; hareket sonra eklenebilir). Mobil konum web'de taklit edilerek denendi; gerçek cihazda izin akışı denenmedi. Aday havuzu en yakın/en aktif 200 kişiyle sınırlı (R14 — yük testi Faz 7).

### Faz 5 — Sohbet ve bildirim ✅ (2026-11-19, onay bekliyor)

- Sohbet eşleşmeyle açılır, eşleşme bitince/engellenince iki taraf için kapanır (mesajlar şikayet kanıtı için silinmez). Erişimin tek kaynağı `ConversationParticipant`; yetkisiz her erişim 404.
- Mesaj: REST ile gönderim (tek doğrulama yolu), istemci UUID'siyle idempotent, dakikada 30 sınırı, boş/2000+ karakter reddi, kendi mesajını silme, okundu bilgisi (yalnızca ileri gider), imleçli sayfalama.
- Gerçek zamanlı: Socket.IO `/ws`, Redis adapter (çok süreç), kimlik doğrulama bağlantı katmanında (doğrulanmamış istemci olay alamaz), kullanıcı odaları; çıkış/oturum iptalinde socket kesilir.
- Bildirim: çevrimiçi kullanıcıya push gönderilmez (olay socket'ten gelir); çevrimdışıysa kuyruk → worker → sağlayıcı arayüzü. Bildirimde mesaj metni ve kişi adı yok. Tür bazında tercihler; geçersiz token'lar devre dışı; cihaz kaydı oturuma bağlı (çıkışta silinir), token başka hesaba geçebilir.
- Push sağlayıcı: arayüz + yalnızca-geliştirme `console` (production'da reddedilir). Gerçek FCM/APNs → açık karar #11 (Firebase + Apple anahtarları gerekir).
- Mobil: Eşleşmeler sekmesi sohbet listesi (son mesaj, okunmamış rozeti), sohbet ekranı (iyimser gönderim, başarısızda tekrar dene, "Görüldü", geçmiş sayfaları), canlı güncelleme, "Eşleştiniz!" → "Mesaj gönder", bildirim tercihleri ve izin, bildirime dokununca sohbeti açma.
- **Testler:** API 84 birim + 122 e2e (gerçek Socket.IO istemcisiyle), mobil 29; canlı sohbet, okundu bilgisi ve çevrimdışı push web önizlemede uçtan uca denendi.
- **Bilinen sınırlamalar:** Push yalnızca geliştirme derlemesi + FCM/APNs anahtarlarıyla çalışır; Expo Go ve web'de çalışmaz, gerçek cihazda denenmedi. Mesaj metin moderasyonu (bağlantı/telefon paylaşımı uyarısı) Faz 6'da.

### Faz 6 — Güvenlik, moderasyon, admin

- Şikayet (kanıt anlık görüntüsü, öncelik), metin kontrolleri, selfie doğrulama.
- Admin API + web paneli (AdminUser, TOTP, roller), AuditLog, AccessLog (5651).
- Veri dışa aktarma işi; silme işinin medya dahil tamamlanması.
- **Testler:** şikayet akışı, admin rol yetkileri, audit kaydı, dışa aktarma içeriği, kalıcı silme sonrası veri kalmaması.
- **Bağımlı kararlar:** #1 doğrulama zorunluluğu, #13 admin paneli, #14 doğrulama sağlayıcı.

### Faz 7 — Lansman hazırlığı

- Sentry (API + mobil, PII kapalı; Faz 2'den), hukuki metinler, VERBİS, alt işleyici envanteri ve aktarım sözleşmeleri, 5651 süreçleri.
- Mağaza uyumu: 18+ derecelendirme, hesap silme uygulama içinden, gizlilik etiketleri / Data safety, kullanıcı içeriği politikası (engelle/şikayet görünür).
- Yük testi (keşfet sorgusu, socket), güvenlik testi (OWASP MASVS/ASVS kontrol listesi), yedekleme/geri yükleme provası.
- Maestro E2E, EAS production build, kapalı beta (TestFlight / Play internal).
- **Bağımlı kararlar:** #8 barındırma, #15–#18 hukuki.

## MVP sonrası

| Faz | Kapsam                                                                                                                                         | Ön koşul                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 8   | Premium: RevenueCat veya doğrudan mağaza API'leri, webhook, yetki kontrolü, paywall                                                            | MVP; mağaza hesapları, vergi/şirket bilgileri           |
| 9   | AI Matchmaker: LLM ile sohbet tabanlı onboarding, tercih çıkarımı (kullanıcı onayıyla), açıklama zenginleştirme; sağlayıcıdan bağımsız adaptör | MVP; AI sağlayıcısı + yurt dışı aktarım değerlendirmesi |
| 10  | Voice Profile: ≤30 sn kayıt, moderasyon, oynatma                                                                                               | MVP                                                     |
| 11  | Chemistry Games                                                                                                                                | Faz 5                                                   |
| 12  | Date Planner                                                                                                                                   | Faz 5                                                   |
| 13  | Double Date (ikili gruplar, grup sohbeti)                                                                                                      | Faz 12                                                  |

Ana sekmeler (Voice, Planlar) ilgili fazlar bitince açılır.
