-- Un viaje (Booking) se compone de varias reservas (BookingItem): paquete Disney, tickets Universal,
-- auto, hotel... Cada reserva tiene su estado, sus pagos, su fecha de venta y su comisión.
-- Los datos de pagos y comisión que estaban en el viaje se trasladan a sus reservas.

CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

ALTER TABLE "BookingItem"
  ADD COLUMN "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "depositAmount" DECIMAL(12,2),
  ADD COLUMN "depositPaidAt" DATE,
  ADD COLUMN "balanceDue" DATE,
  ADD COLUMN "balancePaidAt" DATE,
  ADD COLUMN "saleDate" DATE,
  ADD COLUMN "commissionStatus" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "commissionPaidAt" DATE,
  ADD COLUMN "commissionPaidAmount" DECIMAL(12,2),
  ADD COLUMN "commissionNotes" TEXT;

-- 1. Viajes sin reservas cargadas pero con importes: se crea una reserva con esos importes.
INSERT INTO "BookingItem" ("id", "bookingId", "type", "description", "price", "commissionAmount", "position", "createdAt")
SELECT 'mig' || substr(md5(b."id"), 1, 22), b."id", 'OTHER', b."title", b."totalPrice", b."commissionAmount", 0, b."createdAt"
FROM "Booking" b
WHERE NOT EXISTS (SELECT 1 FROM "BookingItem" i WHERE i."bookingId" = b."id")
  AND (b."totalPrice" > 0 OR b."commissionAmount" > 0);

-- 2. Estado, fecha de venta y comisión del viaje → todas sus reservas.
UPDATE "BookingItem" i
SET "status" = CASE
      WHEN b."status" = 'CANCELLED' THEN 'CANCELLED'::"ReservationStatus"
      WHEN b."status" IN ('BOOKED', 'PAID_IN_FULL', 'TRAVELED', 'COMPLETED') THEN 'CONFIRMED'::"ReservationStatus"
      ELSE 'PENDING'::"ReservationStatus" END,
    "saleDate" = b."saleDate",
    "commissionStatus" = b."commissionStatus",
    "commissionPaidAt" = b."commissionPaidAt",
    "commissionPaidAmount" = CASE WHEN b."commissionStatus" = 'PAID' THEN i."commissionAmount" END,
    "commissionNotes" = b."commissionNotes"
FROM "Booking" b
WHERE b."id" = i."bookingId";

-- 3. Depósito y pago final del viaje → su reserva de mayor importe.
UPDATE "BookingItem" i
SET "depositAmount" = b."depositAmount",
    "depositPaidAt" = b."depositPaidAt",
    "balanceDue" = b."finalPaymentDue",
    "balancePaidAt" = b."finalPaymentPaidAt"
FROM "Booking" b
WHERE b."id" = i."bookingId"
  AND i."id" = (SELECT x."id" FROM "BookingItem" x WHERE x."bookingId" = b."id" ORDER BY x."price" DESC, x."position" ASC LIMIT 1);

-- 4. Planillas: cada viaje incluido pasa a ser una fila por cada una de sus reservas.
ALTER TABLE "CommissionStatementItem" ADD COLUMN "bookingItemId" TEXT;
ALTER TABLE "CommissionStatementItem" ALTER COLUMN "bookingId" DROP NOT NULL;
INSERT INTO "CommissionStatementItem" ("id", "statementId", "bookingItemId", "expectedAmount")
SELECT 'mig' || substr(md5(s."id" || i."id"), 1, 22), s."statementId", i."id", i."commissionAmount"
FROM "CommissionStatementItem" s
JOIN "BookingItem" i ON i."bookingId" = s."bookingId";
DELETE FROM "CommissionStatementItem" WHERE "bookingItemId" IS NULL;

ALTER TABLE "CommissionStatementItem" DROP CONSTRAINT "CommissionStatementItem_bookingId_fkey";
DROP INDEX "CommissionStatementItem_statementId_bookingId_key";
ALTER TABLE "CommissionStatementItem" DROP COLUMN "bookingId";
ALTER TABLE "CommissionStatementItem" ALTER COLUMN "bookingItemId" SET NOT NULL;
CREATE UNIQUE INDEX "CommissionStatementItem_statementId_bookingItemId_key" ON "CommissionStatementItem"("statementId", "bookingItemId");
ALTER TABLE "CommissionStatementItem" ADD CONSTRAINT "CommissionStatementItem_bookingItemId_fkey" FOREIGN KEY ("bookingItemId") REFERENCES "BookingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. El viaje se queda solo con los totales (suma de sus reservas).
ALTER TABLE "Booking"
  DROP COLUMN "depositAmount",
  DROP COLUMN "depositPaidAt",
  DROP COLUMN "finalPaymentDue",
  DROP COLUMN "finalPaymentPaidAt",
  DROP COLUMN "commissionStatus",
  DROP COLUMN "commissionPaidAt",
  DROP COLUMN "commissionPaidAmount",
  DROP COLUMN "commissionNotes",
  DROP COLUMN "saleDate";

CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");
