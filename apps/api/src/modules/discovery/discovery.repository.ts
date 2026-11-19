import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import type { Gender } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

export type ViewerFilter = {
  viewerId: string;
  gender: Gender;
  age: number;
  seekingGenders: Gender[];
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
  /** Türkiye saatine göre bugün (YYYY-MM-DD); adayların yaşı buna göre hesaplanır. */
  today: string;
};

export type CandidateRow = {
  userId: string;
  age: number;
  distanceMeters: number;
  lastActiveAt: Date;
  verified: boolean;
  candidateMaxDistanceKm: number;
  displayName: string;
  gender: Gender;
  bio: string | null;
  jobTitle: string | null;
  heightCm: number | null;
  cityName: string | null;
  relationshipGoal: string | null;
  smoking: string | null;
  drinking: string | null;
  exercise: string | null;
  wantsChildren: boolean | null;
  communicationStyle: string | null;
};

/** Puanlamaya girecek en fazla aday sayısı (en yakın ve en aktif olanlar). */
const POOL_SIZE = 200;

/**
 * Keşfet sert filtreleri tek SQL sorgusunda ve karşılıklı uygulanır:
 * - Hesap aktif, profil görünür, konumu ve en az bir ONAYLI fotoğrafı var
 * - Cinsiyet: aday görüntüleyenin aradığı cinsiyette VE görüntüleyen adayın aradığı cinsiyette
 *   (aranan cinsiyet yalnızca rıza varken doludur, K7)
 * - Yaş: her iki tarafın yaş aralığına uyuyor
 * - Mesafe: iki tarafın da en fazla uzaklık tercihinin içinde
 * - İki yönlü engel yok
 * Listelemede ayrıca: daha önce beğenilmiş, süresi dolmamış "geç" verilmiş veya eşleşilmiş (bitmiş
 * eşleşmeler dahil) kişiler gösterilmez.
 */
@Injectable()
export class DiscoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCandidates(filter: ViewerFilter, options: { onlyUserId?: string; excludeActedOn: boolean }) {
    const onlyUser = options.onlyUserId
      ? Prisma.sql`AND u."id" = ${options.onlyUserId}::uuid`
      : Prisma.empty;
    const notActedOn = options.excludeActedOn
      ? Prisma.sql`
        AND NOT EXISTS (SELECT 1 FROM "Like" l WHERE l."actorId" = ${filter.viewerId}::uuid AND l."targetId" = u."id")
        AND NOT EXISTS (
          SELECT 1 FROM "Pass" ps
          WHERE ps."actorId" = ${filter.viewerId}::uuid AND ps."targetId" = u."id" AND ps."expiresAt" > now()
        )
        AND NOT EXISTS (
          SELECT 1 FROM "Match" m
          WHERE (m."userAId" = ${filter.viewerId}::uuid AND m."userBId" = u."id")
             OR (m."userBId" = ${filter.viewerId}::uuid AND m."userAId" = u."id")
        )`
      : Prisma.empty;

    return this.prisma.$queryRaw<CandidateRow[]>`
      WITH viewer AS (
        SELECT "location" FROM "Profile" WHERE "userId" = ${filter.viewerId}::uuid
      ),
      candidates AS (
        SELECT
          u."id" AS "userId",
          date_part('year', age(${filter.today}::date, u."birthDate"))::int AS "age",
          ST_Distance(p."location", viewer."location") AS "distanceMeters",
          u."lastActiveAt",
          (u."verifiedAt" IS NOT NULL) AS "verified",
          pr."maxDistanceKm" AS "candidateMaxDistanceKm",
          pr."minAge" AS "candidateMinAge",
          pr."maxAge" AS "candidateMaxAge",
          p."displayName", p."gender", p."bio", p."jobTitle", p."heightCm", p."cityName",
          p."relationshipGoal"::text AS "relationshipGoal",
          p."smoking"::text AS "smoking",
          p."drinking"::text AS "drinking",
          p."exercise"::text AS "exercise",
          p."wantsChildren",
          p."communicationStyle"::text AS "communicationStyle"
        FROM "User" u
        JOIN "Profile" p ON p."userId" = u."id"
        JOIN "Preference" pr ON pr."userId" = u."id"
        CROSS JOIN viewer
        WHERE u."id" <> ${filter.viewerId}::uuid
          AND u."status" = 'ACTIVE'
          AND u."birthDate" IS NOT NULL
          AND NOT u."verificationRequired"
          AND NOT u."moderationHold"
          AND p."isDiscoverable"
          AND p."location" IS NOT NULL
          AND viewer."location" IS NOT NULL
          AND p."gender" = ANY(${filter.seekingGenders}::text[]::"Gender"[])
          AND ${filter.gender}::text::"Gender" = ANY(pr."seekingGenders")
          AND ${filter.age} BETWEEN pr."minAge" AND pr."maxAge"
          AND ST_DWithin(
            p."location",
            viewer."location",
            LEAST(${filter.maxDistanceKm}, pr."maxDistanceKm") * 1000
          )
          AND EXISTS (
            SELECT 1 FROM "ProfilePhoto" ph WHERE ph."userId" = u."id" AND ph."status" = 'APPROVED'
          )
          AND NOT EXISTS (
            SELECT 1 FROM "Block" b
            WHERE (b."blockerId" = ${filter.viewerId}::uuid AND b."blockedId" = u."id")
               OR (b."blockerId" = u."id" AND b."blockedId" = ${filter.viewerId}::uuid)
          )
          ${onlyUser}
          ${notActedOn}
      )
      SELECT * FROM candidates
      WHERE "age" BETWEEN ${filter.minAge} AND ${filter.maxAge}
      ORDER BY "distanceMeters" ASC, "lastActiveAt" DESC
      LIMIT ${POOL_SIZE}`;
  }

  /**
   * Eşleşilen kişinin profil satırı: keşfet filtreleri (cinsiyet, yaş, mesafe, görünürlük) uygulanmaz,
   * yalnızca hesap aktif ve iki yönlü engel yok. Eşleşme varlığı çağıran tarafta kontrol edilir.
   */
  async findProfileRow(
    viewerId: string,
    targetId: string,
    today: string,
  ): Promise<CandidateRow | undefined> {
    const rows = await this.prisma.$queryRaw<CandidateRow[]>`
      SELECT
        u."id" AS "userId",
        date_part('year', age(${today}::date, u."birthDate"))::int AS "age",
        COALESCE(ST_Distance(p."location", v."location"), 0) AS "distanceMeters",
        u."lastActiveAt",
        (u."verifiedAt" IS NOT NULL) AS "verified",
        COALESCE(pr."maxDistanceKm", 50) AS "candidateMaxDistanceKm",
        p."displayName", p."gender", p."bio", p."jobTitle", p."heightCm", p."cityName",
        p."relationshipGoal"::text AS "relationshipGoal",
        p."smoking"::text AS "smoking",
        p."drinking"::text AS "drinking",
        p."exercise"::text AS "exercise",
        p."wantsChildren",
        p."communicationStyle"::text AS "communicationStyle"
      FROM "User" u
      JOIN "Profile" p ON p."userId" = u."id"
      LEFT JOIN "Preference" pr ON pr."userId" = u."id"
      LEFT JOIN "Profile" v ON v."userId" = ${viewerId}::uuid
      WHERE u."id" = ${targetId}::uuid
        AND u."status" = 'ACTIVE'
        AND u."birthDate" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "Block" b
          WHERE (b."blockerId" = ${viewerId}::uuid AND b."blockedId" = u."id")
             OR (b."blockerId" = u."id" AND b."blockedId" = ${viewerId}::uuid)
        )`;
    return rows[0];
  }
}
