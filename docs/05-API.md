# 05 — API Modül Spesifikasyonu

Taban: `/api/v1` · Biçim: JSON · Belge: Swagger UI `/api/docs` (production'da kapalı veya korumalı), OpenAPI JSON CI'da üretilir.

## Ortak kurallar

**Kimlik:** `Authorization: Bearer <accessToken>`. 🔓 = kimlik gerekmez, 🛡 = admin token.

> Faz 2 itibarıyla uygulanmış uçların kesin şeması: `packages/api-contract/openapi.json` (koddan üretilir). Bu belge tasarım özetidir.

**Başarılı yanıt**

```json
{ "data": { ... }, "meta": { "nextCursor": "..." } }
```

**Hata yanıtı**

```json
{ "error": { "code": "MATCH_NOT_FOUND", "message": "İnsan okunur mesaj", "details": [ ... ] }, "requestId": "..." }
```

| HTTP | Örnek `code`                                                     |
| ---- | ---------------------------------------------------------------- |
| 400  | `VALIDATION_FAILED`                                              |
| 401  | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `REFRESH_TOKEN_REUSED`       |
| 403  | `FORBIDDEN`, `ACCOUNT_SUSPENDED`, `CONSENT_REQUIRED`, `UNDERAGE` |
| 404  | `NOT_FOUND` (yetkisiz erişimde de 404 — varlık sızdırılmaz)      |
| 409  | `ALREADY_EXISTS`, `PROFILE_INCOMPLETE`                           |
| 422  | `OTP_INVALID`, `OTP_EXPIRED`, `PHOTO_LIMIT_REACHED`              |
| 429  | `RATE_LIMITED` (+ `Retry-After`)                                 |

**Sayfalama:** cursor tabanlı — `?cursor=...&limit=20` (maks 50). Offset yok.
**İdempotency:** Like/Pass doğası gereği idempotent; mesajda istemci `id` (UUID) üretir; ödeme webhook'larında mağaza işlem kimliği.
**Sürümleme:** kırıcı değişiklik → `/api/v2`; mobil minimum sürüm `GET /app/config` ile zorlanabilir.

## Auth (K2: telefon OTP)

| Yöntem  | Yol                  | Açıklama                                                                                                 |
| ------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| POST 🔓 | `/auth/otp/request`  | `{ phone }` (E.164). Her zaman 202 döner (numara varlığı sızdırılmaz). Rate limit: telefon/IP/cihaz.     |
| POST 🔓 | `/auth/otp/verify`   | `{ phone, code, deviceId }` → `{ accessToken, refreshToken, user: { id, isNew, onboardingStep } }`       |
| POST 🔓 | `/auth/refresh`      | `{ refreshToken }` → yeni çift (rotasyon). Eski token tekrar → 401 `REFRESH_TOKEN_REUSED`, oturum iptal. |
| POST    | `/auth/logout`       | Mevcut oturumu iptal eder.                                                                               |
| GET     | `/auth/sessions`     | Aktif oturumlar (cihaz, son kullanım).                                                                   |
| DELETE  | `/auth/sessions/:id` | Tek oturumu iptal.                                                                                       |

Brief'teki `/auth/register` ve `/auth/login`, K2 kararıyla bu iki OTP ucuna dönüştü.

## Users & Privacy

| Yöntem | Yol                   | Açıklama                                                                                                       |
| ------ | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET    | `/users/me`           | Hesap + onboarding durumu + rıza özeti                                                                         |
| PATCH  | `/users/me`           | `{ birthDate }` (yalnızca onboarding'de bir kez; sonrası destek üzerinden)                                     |
| DELETE | `/users/me`           | Silme talebi (30 gün bekleme). `POST /users/me/restore` ile geri alınır.                                       |
| GET    | `/privacy/consents`   | Güncel rıza durumları + metin sürümleri                                                                        |
| POST   | `/privacy/consents`   | `{ decisions: [{ type, granted, textVersion }] }` — tek işlemde; zorunlu metin geri alınamaz, eski sürüm → 409 |
| POST   | `/privacy/export`     | Veri dışa aktarma talebi (asenkron)                                                                            |
| GET    | `/privacy/export/:id` | Durum + hazırsa süreli indirme bağlantısı                                                                      |

## Profiles

| Yöntem  | Yol                                | Açıklama                                                                                                                     |
| ------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/profiles/me`                     | Kendi profili (moderasyon durumlarıyla)                                                                                      |
| PUT     | `/profiles/me`                     | Profil oluştur/güncelle                                                                                                      |
| PUT     | `/profiles/me/interests`           | `{ interestIds: [] }` (maks 10)                                                                                              |
| GET 🔓  | `/interests`                       | Katalog (cache'li)                                                                                                           |
| GET/PUT | `/profiles/me/preferences`         | Yaş, mesafe, hedefler; `seekingGenders` → `CONSENT_REQUIRED` olmadan reddedilir                                              |
| PUT     | `/profiles/me/location`            | `{ lat, lng }` → sunucu bulanıklaştırır; yanıtta koordinat yok. Rate limit.                                                  |
| POST    | `/profiles/me/photos/upload-url`   | `{ contentType, sizeBytes }` → `{ photoId, uploadUrl, expiresAt }` (presigned PUT)                                           |
| POST    | `/profiles/me/photos/:id/complete` | Yükleme bitti → moderasyon kuyruğu                                                                                           |
| PATCH   | `/profiles/me/photos/order`        | `{ photoIds: [] }`                                                                                                           |
| DELETE  | `/profiles/me/photos/:id`          | Sil (S3 dahil)                                                                                                               |
| GET     | `/profiles/:userId`                | Başka profil — yalnızca keşfette görünebilir veya eşleşilmişse; engel varsa 404. Fotoğraflar süreli URL, mesafe yuvarlanmış. |

## Discovery

| Yöntem | Yol                   | Açıklama                                                                                                                           |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/discovery?limit=10` | Aday kartları: `{ userId, displayName, age, cityName, distanceLabel, photos[], interests[], compatibility: { score, reasons[] } }` |

`distanceLabel` örn. `"3 km"`, `"2 km'den yakın"`. Ham koordinat veya kesin mesafe dönmez.

## Matching

| Yöntem | Yol            | Açıklama                                              |
| ------ | -------------- | ----------------------------------------------------- |
| POST   | `/likes`       | `{ targetUserId }` → `{ matched: boolean, matchId? }` |
| POST   | `/passes`      | `{ targetUserId }`                                    |
| GET    | `/matches`     | Aktif eşleşmeler (cursor)                             |
| DELETE | `/matches/:id` | Unmatch — sohbet iki taraftan da kapanır              |

## Chat

| Yöntem | Yol                                      | Açıklama                      |
| ------ | ---------------------------------------- | ----------------------------- |
| GET    | `/conversations`                         | Son mesaj, okunmamış sayısı   |
| GET    | `/conversations/:id/messages?cursor=`    | Katılımcı + engel kontrolü    |
| POST   | `/conversations/:id/messages`            | `{ id, body }` (istemci UUID) |
| POST   | `/conversations/:id/read`                | `{ lastReadMessageId }`       |
| DELETE | `/conversations/:id/messages/:messageId` | Kendi mesajını sil            |

**Socket.IO** (`/ws`, handshake'te access token; süresi dolunca istemci yeniden bağlanır)

| Olay                  | Yön | Yük                                             |
| --------------------- | --- | ----------------------------------------------- |
| `message:new`         | S→C | mesaj                                           |
| `message:read`        | S→C | `{ conversationId, userId, lastReadMessageId }` |
| `typing`              | C↔S | `{ conversationId }` (rate limit'li)            |
| `match:new`           | S→C | `{ matchId }`                                   |
| `conversation:closed` | S→C | unmatch/engel                                   |

Mesaj gönderme REST üzerinden (tek doğrulama yolu); socket yalnızca dağıtım içindir. Odalar sunucuda katılımcı kontrolüyle atanır, istemci oda adı seçemez.

## Safety

| Yöntem | Yol                           | Açıklama                                                                                                          |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| POST   | `/safety/block`               | `{ userId }` → eşleşme kapanır, sohbet gizlenir, iki yönlü görünmezlik                                            |
| DELETE | `/safety/block/:userId`       | Engeli kaldır (eşleşme geri gelmez)                                                                               |
| GET    | `/safety/blocks`              | Engellenenler                                                                                                     |
| POST   | `/safety/report`              | `{ userId, reason, targetType, targetId?, comment? }` → kanıt anlık görüntüsü alınır; isteğe bağlı otomatik engel |
| POST   | `/safety/verification/selfie` | Doğrulama oturumu başlat → sağlayıcı oturum bilgisi                                                               |
| GET    | `/safety/verification`        | Doğrulama durumu                                                                                                  |

## Notifications

| Yöntem         | Yol                          | Açıklama                                                                                  |
| -------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| POST (Faz 5)   | `/devices`                   | `{ platform, pushToken, appVersion, locale }` (upsert; token başka hesaptaysa devredilir) |
| DELETE (Faz 5) | `/devices/:id`               | Çıkışta                                                                                   |
| GET            | `/notifications`             | Uygulama içi bildirimler                                                                  |
| POST           | `/notifications/read`        | `{ ids }`                                                                                 |
| GET/PUT        | `/notifications/preferences` | Push türleri, pazarlama rızası                                                            |

## App

| Yöntem | Yol                             | Açıklama                                                   |
| ------ | ------------------------------- | ---------------------------------------------------------- |
| GET 🔓 | `/app/config`                   | Minimum uygulama sürümü, hukuki metin listesi ve sürümleri |
| GET 🔓 | `/legal/documents/:type`        | Hukuki metnin güncel sürümü (markdown)                     |
| GET 🔓 | `/health/live`, `/health/ready` | Sağlık                                                     |

## Admin (🛡, Faz 6)

| Yöntem | Yol                                              | Açıklama                                                 |
| ------ | ------------------------------------------------ | -------------------------------------------------------- |
| POST   | `/admin/auth/login`                              | e-posta + parola + TOTP                                  |
| GET    | `/admin/reports?status=&priority=`               | Şikayet kuyruğu                                          |
| PATCH  | `/admin/reports/:id`                             | Durum + karar notu                                       |
| GET    | `/admin/moderation/queue`                        | `NEEDS_REVIEW` fotoğraf/bio                              |
| POST   | `/admin/moderation/:subjectType/:id/decision`    | Onayla/reddet                                            |
| GET    | `/admin/users/:id`                               | Hesap özeti (mesaj içeriği yok; yalnızca şikayet kanıtı) |
| POST   | `/admin/users/:id/suspend` · `/ban` · `/restore` | Hesap işlemleri                                          |
| GET    | `/admin/audit-logs`                              | Denetim kaydı                                            |

Her admin yazma işlemi `AuditLog`'a yazılır. Roller: MODERATOR (kuyruk), SUPPORT (hesap görüntüleme), ADMIN (ban), SUPER_ADMIN (admin yönetimi).

## MVP sonrası (taslak)

| Modül            | Uçlar                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Payments (Faz 8) | `GET /subscriptions/me`, `POST /webhooks/app-store`, `POST /webhooks/play` (imza doğrulamalı, 🔓 ama imzasız istek reddedilir) |
| AI (Faz 9)       | `POST /ai/onboarding/messages` (sohbet ile tercih çıkarımı → kullanıcı onayıyla `Preference`'a yazılır)                        |
| Voice (Faz 10)   | `POST /voice/upload-url`, `POST /voice/complete`, `DELETE /voice`                                                              |
| Games (Faz 11)   | `GET /games`, `POST /conversations/:id/games`, `POST /games/:sessionId/answers`                                                |
| Plans (Faz 12)   | `POST /plans`, `GET /plans`, `PATCH /plans/:id`, `POST /plans/:id/respond`                                                     |
| Groups (Faz 13)  | `POST /groups`, `POST /groups/:id/invite`, `POST /groups/:id/respond`, `GET /groups/discovery`                                 |
