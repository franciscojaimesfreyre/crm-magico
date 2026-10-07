-- Pagos en cuotas por reserva: el cliente paga el depósito y después lo que quiera hasta saldar.

CREATE TABLE "ReservationPayment" (
    "id" TEXT NOT NULL,
    "bookingItemId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReservationPayment_bookingItemId_idx" ON "ReservationPayment"("bookingItemId");
ALTER TABLE "ReservationPayment" ADD CONSTRAINT "ReservationPayment_bookingItemId_fkey"
    FOREIGN KEY ("bookingItemId") REFERENCES "BookingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingItem" ADD COLUMN "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Depósitos ya pagados → un pago "Depósito".
INSERT INTO "ReservationPayment" ("id", "bookingItemId", "amount", "paidAt", "note")
SELECT 'mig_dep_' || "id", "id", CASE WHEN "price" > 0 THEN LEAST("depositAmount", "price") ELSE "depositAmount" END, "depositPaidAt", 'Depósito'
FROM "BookingItem"
WHERE "depositPaidAt" IS NOT NULL AND "depositAmount" IS NOT NULL AND "depositAmount" > 0;

-- Saldos marcados como pagados → un pago "Saldo" por lo que faltaba.
INSERT INTO "ReservationPayment" ("id", "bookingItemId", "amount", "paidAt", "note")
SELECT 'mig_sal_' || i."id", i."id",
       i."price" - COALESCE((SELECT sum(p."amount") FROM "ReservationPayment" p WHERE p."bookingItemId" = i."id"), 0),
       i."balancePaidAt", 'Saldo'
FROM "BookingItem" i
WHERE i."balancePaidAt" IS NOT NULL
  AND i."price" - COALESCE((SELECT sum(p."amount") FROM "ReservationPayment" p WHERE p."bookingItemId" = i."id"), 0) > 0;

UPDATE "BookingItem" i
SET "paidAmount" = COALESCE((SELECT sum(p."amount") FROM "ReservationPayment" p WHERE p."bookingItemId" = i."id"), 0);

ALTER TABLE "BookingItem" DROP COLUMN "depositPaidAt";
