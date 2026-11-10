-- AlterTable
ALTER TABLE "BookingItem" ADD COLUMN     "quoteItemId" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "acceptedVia" TEXT;

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "depositAmount" DECIMAL(12,2),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "sourceItemId" TEXT;

-- CreateIndex
CREATE INDEX "BookingItem_quoteItemId_idx" ON "BookingItem"("quoteItemId");

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "QuoteItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "BookingItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
