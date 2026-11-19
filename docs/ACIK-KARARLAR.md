# Kararlar ve Açık Konular

Son güncelleme: 2026-11-19

## Verilen kararlar (2026-11-19)

| #   | Konu                                  | Karar                                                                                                         | Sonuç                                                                                                                                                                                                                            |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Backend                               | **NestJS + Prisma + PostgreSQL + Redis + Socket.IO** (brief'teki yığın)                                       | Modüler monolit. Supabase kullanılmıyor.                                                                                                                                                                                         |
| K2  | Giriş yöntemi                         | **Telefon + SMS OTP**                                                                                         | Kullanıcı parolası yok. Brief'teki `register/login` yerine `otp/request` + `otp/verify`. Parola yalnızca admin paneli için (argon2id + TOTP). Apple/Google ile giriş şimdilik yok — eklenirse ikisi birlikte eklenir.            |
| K3  | MVP kapsamı                           | **Çekirdek**: kayıt/doğrulama, profil, keşfet, beğen/geç, eşleşme, sohbet, engelle/şikayet, moderasyon, admin | Voice, Games, Double Date, Date Planner, Premium, LLM tabanlı AI Matchmaker MVP sonrası.                                                                                                                                         |
| K4  | Lansman                               | **Türkiye geneli**                                                                                            | Kullanıcı yoğunluğu düşük kalabilir → bkz. [08-RISKLER.md](08-RISKLER.md) R1. Mimari çok ülkeye açık.                                                                                                                            |
| K5  | Paket yöneticisi                      | **npm workspaces** (Faz 1, 2026-11-19)                                                                        | pnpm makinede kurulu değildi, Node 26'da corepack yok, global kurulum sudo istiyordu. npm ek araç gerektirmez; Expo monorepo rehberi npm'i destekliyor. Kurulum betikleri `package.json` → `allowScripts` ile tek tek onaylanır. |
| K6  | Cinsiyet seçenekleri                  | **Kadın / Erkek / Non-binary / Diğer** (Faz 3, 2026-11-19)                                                    | Keşfette "aranan cinsiyet" bu dördünden çoklu seçilir.                                                                                                                                                                           |
| K7  | Aranan cinsiyet (özel nitelikli veri) | **Ayrı açık rıza; rıza yoksa keşfet ve eşleşme kapalı** (Faz 3)                                               | Rıza vermeyen kullanıcı profil oluşturabilir. Rıza geri alınırsa tercih silinir, keşfet durur.                                                                                                                                   |
| K8  | Fotoğraf denetimi                     | **Sağlayıcıdan bağımsız arayüz; geliştirmede otomatik onay** (Faz 3)                                          | Production, gerçek sağlayıcı bağlanmadan başlamaz. Sağlayıcı ve yurt dışı aktarım kararı Faz 6–7 öncesi (açık karar #12).                                                                                                        |
| K9  | Yerel S3                              | **SeaweedFS** (Faz 3, teknik karar)                                                                           | MinIO topluluk imajları yayından kalktı. SeaweedFS imzalı Content-Type'ı zorlamıyor; sunucu yüklenen dosyayı zaten kendisi doğruluyor.                                                                                           |
| K10 | Yönetim paneli (#13)                  | **Ayrı web uygulaması** (`apps/admin`, Faz 6)                                                                 | E-posta + argon2id parola + TOTP; rol bazlı yetki; tüm yazma işlemleri denetim kaydına.                                                                                                                                          |
| K11 | Selfie doğrulama (#1)                 | **Rozet; gerektiğinde zorunlu** (Faz 6)                                                                       | İsteğe bağlı; moderatör şüpheli/şikayet edilen hesaptan isteyebilir, yapılana kadar keşfette gizlenir.                                                                                                                           |
| K12 | Doğrulama sağlayıcısı (#14)           | **Arayüz + moderatör incelemesi** (Faz 6)                                                                     | Selfie profil fotoğraflarıyla insan tarafından karşılaştırılır; biyometrik veri üçüncü tarafa gitmez. Otomatik canlılık sağlayıcısı sonra aynı arayüze bağlanır.                                                                 |

## Brief'e eklenen değerlendirme notları → nereye işlendi

| Not                                                                             | İşlendiği yer                                                                                       |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| KVKK özel nitelikli veri (cinsel yönelim / aranan cinsiyet) için ayrı açık rıza | `ConsentRecord` modeli, [01-MIMARI.md §7](01-MIMARI.md), [05-API.md](05-API.md) `/privacy/consents` |
| Yurt dışı veri aktarımı (S3, Sentry, FCM/APNs, AI sağlayıcısı)                  | [01-MIMARI.md §7.3](01-MIMARI.md), R4                                                               |
| 5651 sayılı kanun (log saklama, içerik kaldırma)                                | [01-MIMARI.md §7.4](01-MIMARI.md), `AccessLog`, R5                                                  |
| 18+ doğrulama                                                                   | [01-MIMARI.md §7.5](01-MIMARI.md), `Verification`, R3                                               |
| Uygulama içi satın alma + sunucu tarafı makbuz doğrulama                        | [01-MIMARI.md §5.14](01-MIMARI.md), `Subscription`/`StoreTransaction`, Faz 8                        |
| Konum yuvarlama / sapma (trilateration)                                         | [01-MIMARI.md §6](01-MIMARI.md), R2                                                                 |
| `Pass` varlığı                                                                  | [04-schema.prisma](04-schema.prisma) `Pass`                                                         |
| `Match` için sıralı çift + unique                                               | `Match` (`userAId < userBId` CHECK + `@@unique`)                                                    |
| Fotoğraf moderasyonu                                                            | Safety modülü, `ProfilePhoto.moderationStatus`, `ModerationDecision`                                |

## Hâlâ açık olan kararlar

Faz 1 öncesi gerekli olanlar **kalın**.

### Ürün

1. ~~Doğrulama zorunluluğu~~ → K11.
2. ~~Cinsiyet seçenekleri ve aranan cinsiyet~~ → K6, K7.
3. Günlük beğeni limiti var mı? (Premium'a hazırlık; MVP'de yalnızca spam limiti önerilir.)
4. Geçilen (pass) profil ne kadar sonra yeniden gösterilsin? Faz 4'te öneri (30 gün) uygulandı; değiştirmek tek sabit (`PASS_TTL_DAYS`).
5. Eşleşme bitirme (unmatch) sonrası sohbet: her iki taraftan da gizlenir; şikayet için kanıt saklanır.
6. AI Matchmaker MVP'de yalnızca kural tabanlı "neden uyumlusunuz" açıklaması olarak mı yer alsın? (Öneri: evet; LLM onboarding Faz 9.)
7. Hesap silmede bekleme süresi (Öneri: 30 gün geri alınabilir, sonra kalıcı silme.)

### Teknik / altyapı

8. **Barındırma bölgesi:** Türkiye'de (yerli bulut) mi, AB'de (ör. Frankfurt) mi? KVKK yurt dışı aktarım yükünü belirler.
9. **SMS sağlayıcısı:** Yerli (Netgsm, İleti Merkezi vb.) mi, global (Twilio Verify vb.) mi?
10. ~~Paket yöneticisi~~ → K5 ile karar verildi (npm workspaces).
11. Push: FCM/APNs doğrudan mı (brief), Expo Push Service mi? (Öneri: doğrudan; daha az üçüncü taraf aktarımı.)
12. Fotoğraf moderasyon sağlayıcısı (AWS Rekognition, Sightengine, Hive vb.) ve yurt dışı aktarım durumu.
13. ~~Admin paneli~~ → K10.
14. ~~Selfie doğrulama sağlayıcısı~~ → K12 (otomatik sağlayıcı ileride).

### Hukuki (avukat görüşü gerekli)

15. Aydınlatma metni, açık rıza metinleri, kullanım koşulları, topluluk kuralları.
16. VERBİS kaydı ve yurt dışı aktarım için standart sözleşme bildirimleri.
17. 5651 kapsamındaki rol (yer sağlayıcı / sosyal ağ sağlayıcı eşikleri) ve log saklama süreleri.
18. Ticari elektronik ileti (İYS) — pazarlama bildirimleri için.
