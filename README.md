# VIBE

More than a match. Real chemistry.

Türkiye için premium, yapay zekâ destekli tanışma uygulaması. **Durum: Faz 5 (sohbet ve bildirimler) tamamlandı.** Yol haritası: [docs/06-YOL-HARITASI.md](docs/06-YOL-HARITASI.md).

## Gereksinimler

- Node.js ≥ 22.13 (CI: 24, bkz. `.nvmrc`)
- Docker (Docker Desktop veya eşdeğeri)
- Mobil için: iOS simülatörü (Xcode) veya Android emülatörü; hızlı bakış için web de çalışır

## Temiz ortamdan çalıştırma

```bash
npm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

```bash
npm run infra:up
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run api:dev
```

```bash
npm run worker:dev
```

```bash
npm run mobile:start
```

Yönetim paneli (isteğe bağlı):

```bash
cp apps/admin/.env.example apps/admin/.env
```

```bash
npm run admin:create -- --email moderator@example.com --role MODERATOR
```

```bash
npm run admin:dev
```

- Giriş: geliştirmede SMS gönderilmez; doğrulama kodu API'nin terminal logunda `[GELİŞTİRME] ... doğrulama kodu: 123456` olarak görünür.
- Worker: fotoğrafları işler (EXIF temizleme, denetim), push bildirimlerini gönderir (geliştirmede loga yazar) ve hesap silme gibi periyodik işleri çalıştırır. Worker çalışmıyorsa yüklenen fotoğraflar "İşleniyor" durumunda kalır.
- Canlı sohbet: Socket.IO `ws://localhost:3000/ws` (mobil istemci otomatik bağlanır).
- API: http://localhost:3000/api/v1/health/ready · Swagger UI: http://localhost:3000/api/docs
- Mobil: Expo CLI'da `i` (iOS), `a` (Android) veya `w` (web). Android emülatöründe `apps/mobile/.env` içindeki `EXPO_PUBLIC_API_URL`'i `http://10.0.2.2:3000` yapın.
- Yönetim paneli: http://localhost:5173 — `admin:create` parolayı ve TOTP anahtarını yalnızca bir kez yazar; anahtarı bir kimlik doğrulama uygulamasına ekleyin (otpauth adresi de yazdırılır). Roller: `SUPPORT`, `MODERATOR`, `ADMIN`, `SUPER_ADMIN`.
- PostgreSQL `localhost:55432`, Redis `localhost:56379`, S3 (SeaweedFS) `localhost:58333` (diğer projelerle çakışmasın diye standart dışı portlar). Android emülatöründe `apps/api/.env` içindeki `S3_PUBLIC_ENDPOINT`'i `http://10.0.2.2:58333` yapın.

## Komutlar

| Komut                | Ne yapar                                                           |
| -------------------- | ------------------------------------------------------------------ |
| `npm run lint`       | API ve panel (oxlint) + mobil (ESLint)                             |
| `npm run typecheck`  | Tüm çalışma alanlarında TypeScript kontrolü                        |
| `npm test`           | Birim testleri (dış bağımlılık gerektirmez)                        |
| `npm run test:e2e`   | API e2e testleri — `vibe_test` veritabanı ve Redis DB 1 kullanılır |
| `npm run format`     | Prettier                                                           |
| `npm run infra:down` | Docker servislerini durdurur (veriler volume'da kalır)             |

## Yapı

```
apps/api       NestJS 12 modüler monolit (Prisma 7, PostgreSQL + PostGIS, Redis, S3, BullMQ worker)
apps/mobile    Expo SDK 58 + Expo Router (iOS / Android)
apps/admin     Yönetim paneli (Vite + React; moderasyon, doğrulama, hesap işlemleri)
packages/config Paylaşılan TypeScript ve Prettier ayarları
packages/api-contract API'den üretilen OpenAPI + TS tipleri (elle düzenlenmez)
infra          Yerel geliştirme için docker compose
docs           Brief, mimari, veri modeli, API, yol haritası, riskler
```

## Belgeler

| Belge                                              | İçerik                                                       |
| -------------------------------------------------- | ------------------------------------------------------------ |
| [docs/BRIEF.md](docs/BRIEF.md)                     | Ürün ve mühendislik brief'i (orijinal)                       |
| [docs/ACIK-KARARLAR.md](docs/ACIK-KARARLAR.md)     | Verilen kararlar (K1–K12) ve hâlâ açık konular               |
| [docs/01-MIMARI.md](docs/01-MIMARI.md)             | Teknik mimari, güvenlik, KVKK/5651, 18+, moderasyon          |
| [docs/02-REPO-YAPISI.md](docs/02-REPO-YAPISI.md)   | Monorepo yapısı ve kurallar                                  |
| [docs/03-VERI-MODELI.md](docs/03-VERI-MODELI.md)   | ER diyagramı (Mermaid), silme davranışı, kısıtlar            |
| [docs/04-schema.prisma](docs/04-schema.prisma)     | Hedef Prisma şeması (tasarım); gerçek şema `apps/api/prisma` |
| [docs/05-API.md](docs/05-API.md)                   | API modül spesifikasyonu (`/api/v1`)                         |
| [docs/06-YOL-HARITASI.md](docs/06-YOL-HARITASI.md) | Fazlar ve bağımlılıklar                                      |
| [docs/08-RISKLER.md](docs/08-RISKLER.md)           | Riskler ve önlemler                                          |
