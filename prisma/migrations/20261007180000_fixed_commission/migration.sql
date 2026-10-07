-- La comisión puede cargarse como porcentaje o como monto fijo.
ALTER TABLE "BookingItem" ADD COLUMN "commissionFixed" DECIMAL(12,2);
ALTER TABLE "QuoteItem" ADD COLUMN "commissionFixed" DECIMAL(12,2);
