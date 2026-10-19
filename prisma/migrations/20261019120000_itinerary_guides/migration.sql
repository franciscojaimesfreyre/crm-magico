-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'CRUISE' BEFORE 'CUSTOM';

-- AlterTable
ALTER TABLE "ItineraryItem" ADD COLUMN "guide" JSONB;
