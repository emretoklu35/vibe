# 02 — Repo Yapısı

Tek repo (monorepo), npm workspaces (karar K5). Turborepo vb. ek araç başlangıçta yok; ihtiyaç doğarsa eklenir.

```
vibe/
├── apps/
│   ├── api/                         # NestJS modüler monolit
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/          # prisma migrate + ham SQL (PostGIS, CHECK kısıtları)
│   │   │   └── seed.ts              # yalnızca local/staging; sahte kullanıcılar
│   │   ├── src/
│   │   │   ├── main.ts              # HTTP + Socket.IO
│   │   │   ├── worker.ts            # BullMQ işleyicileri (moderasyon, push, silme, export)
│   │   │   ├── app.module.ts
│   │   │   ├── common/              # config, guards, filters, interceptors, pagination, logger
│   │   │   ├── infra/               # prisma, redis, storage (S3), sms, push, moderation adaptörleri
│   │   │   └── modules/
│   │   │       ├── auth/
│   │   │       ├── users/
│   │   │       ├── profiles/
│   │   │       ├── discovery/
│   │   │       │   └── scoring/     # saf fonksiyonlar, AI'dan bağımsız test edilir
│   │   │       ├── matching/
│   │   │       ├── chat/
│   │   │       ├── safety/
│   │   │       ├── notifications/
│   │   │       ├── privacy/         # rıza, export, silme orkestrasyonu
│   │   │       ├── admin/
│   │   │       └── (ai, voice, games, groups, plans, payments — ilgili fazda)
│   │   ├── test/                    # entegrasyon + e2e (supertest)
│   │   └── .env.example
│   ├── mobile/                      # Expo uygulaması
│   │   ├── src/
│   │   │   ├── app/                 # Expo Router rotaları (yalnızca ekranlar + _layout)
│   │   │   │   ├── (auth)/          # telefon, kod, doğum tarihi, rızalar
│   │   │   │   ├── (onboarding)/    # profil, fotoğraf, tercihler
│   │   │   │   └── (tabs)/          # discover, matches, profile
│   │   │   ├── features/            # ekran dışı kod: hooks, bileşenler, servisler (özellik bazlı)
│   │   │   ├── design/              # tasarım sistemi: tokens, typography, components
│   │   │   ├── api/                 # fetch istemcisi, token yenileme, üretilmiş OpenAPI tipleri
│   │   │   └── lib/                 # secure-store, socket, sentry
│   │   ├── app.json / app.config.ts
│   │   ├── eas.json
│   │   └── .maestro/                # mobil E2E akışları
│   └── admin/                       # Faz 6 — moderasyon paneli (web)
├── packages/
│   ├── api-contract/                # OpenAPI JSON + üretilmiş TS tipleri (tek kaynak: API)
│   └── config/                      # paylaşılan tsconfig, eslint, prettier ayarları
├── infra/
│   ├── docker-compose.yml           # postgres+postgis, redis, minio (S3), mailpit yok (OTP log adaptörü)
│   └── (terraform / deploy — Faz 7)
├── docs/
│   ├── BRIEF.md
│   ├── ACIK-KARARLAR.md
│   ├── 01-MIMARI.md … 08-RISKLER.md
│   └── adr/                         # mimari karar kayıtları (ADR-0001-backend-nestjs.md …)
├── .github/workflows/               # ci.yml (lint, typecheck, test, migrate check), mobile-eas.yml
├── package.json                     # workspace kökü, ortak script'ler
├── .env.example                     # (kök: yalnızca compose değişkenleri)
└── README.md                        # temiz ortamdan çalıştırma komutları
```

## Kurallar

- `apps/mobile/src/app/` içinde yalnızca rota dosyaları; diğer her şey `features/`, `design/`, `api/`, `lib/` altında.
- `ios/` ve `android/` klasörleri commit edilmez (Continuous Native Generation); yerel davranış `app.config.ts` ve config plugin'leriyle.
- Mobil paketleri `npx expo install` (veya seçilen paket yöneticisinin `expo install` karşılığı) ile eklenir. Expo API'leri için önce `expo` sürümü ve sürüme özel doküman kontrol edilir.
- İş kuralı tek yerde: API service'leri. Mobil yalnızca UX için doğrular.
- `packages/api-contract` elle düzenlenmez; `npm run contract:generate` ile üretilir, CI farkı kontrol eder.
- Her ortam değişkeni `.env.example`'da açıklamasıyla bulunur; API açılışta Zod ile doğrular, eksikse başlamaz.

## Yerel ortam

Komutlar için bkz. kök [README.md](../README.md).

Local'de SMS gönderilmez: `SMS_PROVIDER=console` adaptörü kodu API loguna yazar (yalnızca `NODE_ENV=development`'ta izinli; production'da açılışta reddedilir).
