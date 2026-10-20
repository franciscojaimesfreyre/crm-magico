-- AlterTable
ALTER TABLE "CatalogEntry" ADD COLUMN     "apiId" TEXT,
ADD COLUMN     "closedByApi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "syncedAt" TIMESTAMP(3),
ADD COLUMN     "typicalWait" INTEGER;
