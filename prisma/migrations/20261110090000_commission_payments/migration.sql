-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "paymentTermDays" INTEGER;

-- AlterTable
ALTER TABLE "CommissionStatement" ADD COLUMN     "remindedAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CommissionStatementItem" ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StatementPayment" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" DATE NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementPayment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StatementPayment" ADD CONSTRAINT "StatementPayment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CommissionStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- "Solicitada" pasa a significar enviada a la agencia: lo que está solo en planillas en borrador vuelve a
-- "Sin cobrar", y las planillas ya enviadas toman como fecha de envío su última actualización.
UPDATE "CommissionStatement" SET "sentAt" = "updatedAt" WHERE "status" <> 'DRAFT' AND "sentAt" IS NULL;
UPDATE "BookingItem" SET "commissionStatus" = 'PENDING'
WHERE "commissionStatus" = 'REQUESTED'
  AND NOT EXISTS (
    SELECT 1 FROM "CommissionStatementItem" i JOIN "CommissionStatement" s ON s."id" = i."statementId"
    WHERE i."bookingItemId" = "BookingItem"."id" AND s."status" <> 'DRAFT'
  );
