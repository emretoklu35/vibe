-- PostGIS: konum tabanlı keşfet (Faz 3) için. Prisma şemada ifade edilemediğinden burada etkinleştirilir.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateTable
CREATE TABLE "Interest" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "labelTr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Interest_slug_key" ON "Interest"("slug");

-- CreateIndex
CREATE INDEX "Interest_category_idx" ON "Interest"("category");
