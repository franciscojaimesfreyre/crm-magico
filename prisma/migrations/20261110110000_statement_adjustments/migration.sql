-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "feePerTrip" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "agentSharePercent" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "StatementAdjustment" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "bookingId" TEXT,
    "bookingItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatementAdjustment_bookingItemId_idx" ON "StatementAdjustment"("bookingItemId");

-- CreateIndex
CREATE INDEX "StatementAdjustment_bookingId_idx" ON "StatementAdjustment"("bookingId");

-- AddForeignKey
ALTER TABLE "StatementAdjustment" ADD CONSTRAINT "StatementAdjustment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CommissionStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

