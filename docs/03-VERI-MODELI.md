# 03 — Veri Modeli ve İlişki Diyagramı

Şema: [04-schema.prisma](04-schema.prisma) (Prisma 6 ile `prisma validate` geçti, 2026-11-19).

## MVP ilişkileri

```mermaid
erDiagram
  User ||--o| Profile : has
  User ||--o| Preference : has
  User ||--o{ UserInterest : selects
  Interest ||--o{ UserInterest : "chosen in"
  Profile ||--o{ ProfilePhoto : has
  User ||--o{ Session : "refresh tokens"
  User ||--o{ UserDevice : "push tokens"
  User ||--o{ ConsentRecord : "gives/withdraws"
  User ||--o{ Verification : undergoes

  User ||--o{ Like : "gives (actor)"
  User ||--o{ Like : "receives (target)"
  User ||--o{ Pass : "gives (actor)"
  User ||--o{ Pass : "receives (target)"
  User ||--o{ Match : "userA (smaller id)"
  User ||--o{ Match : "userB (larger id)"
  Match ||--o| Conversation : opens
  Conversation ||--o{ ConversationParticipant : has
  User ||--o{ ConversationParticipant : joins
  Conversation ||--o{ Message : contains
  User ||--o{ Message : sends

  User ||--o{ Block : blocks
  User ||--o{ Block : "is blocked"
  User |o--o{ Report : files
  User |o--o{ Report : "is reported"
  AdminUser |o--o{ Report : handles
  AdminUser |o--o{ ModerationDecision : decides
  AdminUser |o--o{ AuditLog : performs
  User ||--o{ Notification : receives
  User |o--o{ DataRequest : requests

  User {
    uuid id PK
    string phoneHash UK
    bytes phoneEncrypted
    date birthDate
    enum status
  }
  Profile {
    uuid userId PK,FK
    string displayName
    enum gender
    geography location "fuzzed"
    bool isDiscoverable
  }
  ProfilePhoto {
    uuid id PK
    uuid profileId FK
    string storageKey UK
    int position
    enum moderationStatus
  }
  Like {
    uuid actorId FK
    uuid targetId FK
    unique actorId_targetId
  }
  Pass {
    uuid actorId FK
    uuid targetId FK
    datetime expiresAt
    unique actorId_targetId
  }
  Match {
    uuid id PK
    uuid userAId FK "CHECK userAId < userBId"
    uuid userBId FK
    unique userAId_userBId
    enum status
  }
  Conversation {
    uuid id PK
    uuid matchId UK,FK
    enum kind
  }
  Message {
    uuid id PK "client-generated, idempotent"
    uuid conversationId FK
    uuid senderId FK
    string body
  }
  Block {
    uuid blockerId PK,FK
    uuid blockedId PK,FK
  }
  Report {
    uuid id PK
    enum reason
    enum targetType
    json evidence
    enum status
  }
```

`AccessLog` (5651) bilinçli olarak FK'sızdır; kullanıcı silinse de yasal süre boyunca kalır.

## MVP sonrası ilişkiler (taslak)

```mermaid
erDiagram
  User ||--o| VoiceProfile : "Faz 10"
  User ||--o{ Subscription : "Faz 8"
  Subscription ||--o{ StoreTransaction : records
  Conversation ||--o{ GameSession : "Faz 11 (id ref)"
  GameSession ||--o{ GameAnswer : has
  User ||--o{ GameAnswer : answers
  Group ||--o{ GroupMember : "Faz 13, max 2"
  User ||--o{ GroupMember : joins
  Conversation ||--o{ Plan : "Faz 12 (id ref)"
  User ||--o{ Plan : creates
  Plan ||--o{ PlanParticipant : has
  User ||--o{ PlanParticipant : participates
```

## Silme davranışı

| İlişki                                                                                                                                   | onDelete | Gerekçe                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| User → Profile, Preference, Photo, Interest seçimi, Session, Device, Consent, Verification, Like, Pass, Match, Participant, Notification | Cascade  | Kişisel veri; hesap kalıcı silinince gider. Medya dosyaları silme işi tarafından ayrıca S3'ten silinir.                 |
| User → Message                                                                                                                           | Cascade  | Silinen kullanıcının mesajları karşı taraftan da kalkar. Şikayet edilmiş mesajın kopyası `Report.evidence`'ta saklanır. |
| User → Report (reporter/reported)                                                                                                        | SetNull  | Şikayet ve kanıt inceleme/yasal süre boyunca kalır; `evidencePurgeAt` ile temizlenir.                                   |
| User → DataRequest                                                                                                                       | SetNull  | Silme talebinin yerine getirildiğinin kanıtı.                                                                           |
| AdminUser → AuditLog, Report, ModerationDecision                                                                                         | SetNull  | Denetim izi admin silinse de kalır (adminler pratikte devre dışı bırakılır, silinmez).                                  |
| Interest → UserInterest                                                                                                                  | Restrict | Katalog öğesi kullanımdaysa silinmez; `isActive=false` yapılır.                                                         |

Hesap silme akışı: `DELETE /users/me` → `status=DELETION_PENDING`, keşfetten anında çıkar, tüm oturumlar iptal → 30 gün sonra worker: S3 medyası sil → `User` sil (cascade) → `DataRequest.completedAt`.

## Önemli kısıtlar ve indeksler

- `Like`/`Pass` `@@unique([actorId, targetId])` → çift beğeni imkânsız; API idempotent.
- `Match` `@@unique([userAId, userBId])` + `CHECK (userAId < userBId)` → aynı çift için tek eşleşme, yön bağımsız.
- `Block` birleşik PK + `blockedId` indeksi → keşfet ve sohbette iki yönlü hızlı filtre.
- `Profile.location` GIST indeksi (PostGIS `ST_DWithin`).
- `Message (conversationId, createdAt DESC)` → cursor sayfalama.
- `ConversationParticipant` → sohbet erişim kontrolünün tek kaynağı.
- Prisma'nın desteklemediği CHECK, extension ve GIST indeksleri migration'da ham SQL (listesi şema başlığında).
