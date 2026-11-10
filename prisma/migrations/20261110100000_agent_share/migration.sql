-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "agentSharePercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "BookingItem" ADD COLUMN     "agentSharePercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "CommissionStatementItem" ADD COLUMN     "agentSharePercent" DECIMAL(5,2),
ADD COLUMN     "providerAmount" DECIMAL(12,2);


-- Las planillas que ya existían reclamaron la comisión completa: quedan al 100 %.
UPDATE "CommissionStatementItem" SET "providerAmount" = "expectedAmount", "agentSharePercent" = 100 WHERE "providerAmount" IS NULL;
