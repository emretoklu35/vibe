-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('ACTIVE', 'UNMATCHED');

-- CreateTable
CREATE TABLE "Like" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pass" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" UUID NOT NULL,
    "userAId" UUID NOT NULL,
    "userBId" UUID NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "unmatchedById" UUID,
    "unmatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateIndex
CREATE INDEX "Like_targetId_createdAt_idx" ON "Like"("targetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Like_actorId_targetId_key" ON "Like"("actorId", "targetId");

-- CreateIndex
CREATE INDEX "Pass_actorId_expiresAt_idx" ON "Pass"("actorId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pass_actorId_targetId_key" ON "Pass"("actorId", "targetId");

-- CreateIndex
CREATE INDEX "Match_userAId_status_createdAt_idx" ON "Match"("userAId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Match_userBId_status_createdAt_idx" ON "Match"("userBId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Match_userAId_userBId_key" ON "Match"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Prisma'nın ifade edemediği kısıtlar ───
-- Eşleşme çifti sıralıdır: aynı iki kişi için (A,B) ve (B,A) iki ayrı satır olamaz.
ALTER TABLE "Match" ADD CONSTRAINT "Match_ordered_pair" CHECK ("userAId" < "userBId");
ALTER TABLE "Like" ADD CONSTRAINT "Like_not_self" CHECK ("actorId" <> "targetId");
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_not_self" CHECK ("actorId" <> "targetId");
ALTER TABLE "Block" ADD CONSTRAINT "Block_not_self" CHECK ("blockerId" <> "blockedId");
