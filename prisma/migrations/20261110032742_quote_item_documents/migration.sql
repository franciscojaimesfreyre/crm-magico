-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "quoteItemId" TEXT;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "QuoteItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
