-- CreateEnum
CREATE TYPE "ParkGuideKind" AS ENUM ('PARK', 'EVENT');

-- CreateTable
CREATE TABLE "ParkGuide" (
    "id" TEXT NOT NULL,
    "kind" "ParkGuideKind" NOT NULL DEFAULT 'PARK',
    "destination" "Destination" NOT NULL,
    "name" TEXT NOT NULL,
    "park" TEXT,
    "aliases" TEXT[],
    "openTime" TEXT,
    "closeTime" TEXT,
    "hoursNote" TEXT,
    "arrival" TEXT,
    "mainShow" TEXT,
    "sections" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkGuide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParkGuide_destination_kind_idx" ON "ParkGuide"("destination", "kind");

