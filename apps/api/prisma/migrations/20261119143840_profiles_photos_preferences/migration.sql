-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('WOMAN', 'MAN', 'NON_BINARY', 'OTHER');

-- CreateEnum
CREATE TYPE "RelationshipGoal" AS ENUM ('LONG_TERM', 'LONG_TERM_OPEN_TO_SHORT', 'SHORT_TERM_OPEN_TO_LONG', 'SHORT_TERM', 'NEW_FRIENDS', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('NEVER', 'SOMETIMES', 'OFTEN', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "CommunicationStyle" AS ENUM ('TEXTER', 'CALLER', 'IN_PERSON', 'MIXED');

-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('AWAITING_UPLOAD', 'PROCESSING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW', 'FAILED');

-- CreateTable
CREATE TABLE "Profile" (
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(40) NOT NULL,
    "gender" "Gender" NOT NULL,
    "bio" VARCHAR(500),
    "jobTitle" VARCHAR(60),
    "heightCm" INTEGER,
    "relationshipGoal" "RelationshipGoal",
    "smoking" "Frequency",
    "drinking" "Frequency",
    "exercise" "Frequency",
    "wantsChildren" BOOLEAN,
    "communicationStyle" "CommunicationStyle",
    "cityName" VARCHAR(80),
    "location" geography(Point,4326),
    "locationUpdatedAt" TIMESTAMP(3),
    "isDiscoverable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProfilePhoto" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "storageKey" VARCHAR(200) NOT NULL,
    "uploadKey" VARCHAR(200),
    "position" INTEGER NOT NULL,
    "status" "PhotoStatus" NOT NULL DEFAULT 'AWAITING_UPLOAD',
    "width" INTEGER,
    "height" INTEGER,
    "moderationLabels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ProfilePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInterest" (
    "userId" UUID NOT NULL,
    "interestId" INTEGER NOT NULL,

    CONSTRAINT "UserInterest_pkey" PRIMARY KEY ("userId","interestId")
);

-- CreateTable
CREATE TABLE "Preference" (
    "userId" UUID NOT NULL,
    "minAge" INTEGER NOT NULL DEFAULT 18,
    "maxAge" INTEGER NOT NULL DEFAULT 60,
    "maxDistanceKm" INTEGER NOT NULL DEFAULT 50,
    "seekingGenders" "Gender"[],
    "relationshipGoals" "RelationshipGoal"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Profile_isDiscoverable_gender_idx" ON "Profile"("isDiscoverable", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePhoto_storageKey_key" ON "ProfilePhoto"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePhoto_uploadKey_key" ON "ProfilePhoto"("uploadKey");

-- CreateIndex
CREATE INDEX "ProfilePhoto_userId_status_position_idx" ON "ProfilePhoto"("userId", "status", "position");

-- CreateIndex
CREATE INDEX "ProfilePhoto_status_createdAt_idx" ON "ProfilePhoto"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserInterest_interestId_idx" ON "UserInterest"("interestId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilePhoto" ADD CONSTRAINT "ProfilePhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Prisma'nın ifade edemediği kısıtlar ───
-- Konum sorguları (ST_DWithin) için uzamsal indeks.
CREATE INDEX "Profile_location_gix" ON "Profile" USING GIST ("location");

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_heightCm_range" CHECK ("heightCm" IS NULL OR "heightCm" BETWEEN 120 AND 230);
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_displayName_not_blank" CHECK (length(btrim("displayName")) > 0);
ALTER TABLE "ProfilePhoto" ADD CONSTRAINT "ProfilePhoto_position_range" CHECK ("position" BETWEEN 0 AND 5);
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_age_range" CHECK ("minAge" >= 18 AND "maxAge" <= 99 AND "minAge" <= "maxAge");
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_distance_range" CHECK ("maxDistanceKm" BETWEEN 1 AND 500);
