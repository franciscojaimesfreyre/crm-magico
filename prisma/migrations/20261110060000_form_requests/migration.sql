-- CreateEnum
CREATE TYPE "FormRequestStatus" AS ENUM ('SENT', 'OPENED', 'ANSWERED');

-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "requestId" TEXT;

-- CreateTable
CREATE TABLE "FormRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bookingId" TEXT,
    "token" TEXT NOT NULL,
    "status" "FormRequestStatus" NOT NULL DEFAULT 'SENT',
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),

    CONSTRAINT "FormRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormRequest_token_key" ON "FormRequest"("token");

-- CreateIndex
CREATE INDEX "FormRequest_clientId_idx" ON "FormRequest"("clientId");

-- CreateIndex
CREATE INDEX "FormRequest_bookingId_idx" ON "FormRequest"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "FormSubmission_requestId_key" ON "FormSubmission"("requestId");

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FormRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRequest" ADD CONSTRAINT "FormRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRequest" ADD CONSTRAINT "FormRequest_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRequest" ADD CONSTRAINT "FormRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRequest" ADD CONSTRAINT "FormRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Las respuestas que ya se habían pasado a un cliente con el sistema anterior cuentan como revisadas.
UPDATE "FormSubmission" SET "appliedAt" = "createdAt" WHERE "clientId" IS NOT NULL AND "appliedAt" IS NULL;
