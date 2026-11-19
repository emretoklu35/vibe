-- Kullanıcı başına en fazla bir açık (REQUESTED / PROCESSING) silme talebi.
-- Prisma kısmi index ifade edemediği için ham SQL. Eşzamanlı iki silme isteğinden biri unique ihlali alır.
CREATE UNIQUE INDEX "DataRequest_one_open_deletion_per_user"
  ON "DataRequest" ("userId")
  WHERE "type" = 'DELETION' AND "status" IN ('REQUESTED', 'PROCESSING');
