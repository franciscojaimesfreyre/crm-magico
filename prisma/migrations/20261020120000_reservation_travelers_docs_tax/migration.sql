-- Tipos de reserva para eventos especiales
ALTER TYPE "ItemType" ADD VALUE 'DISNEY_WORLD_EVENT' BEFORE 'DISNEYLAND_PACKAGE';
ALTER TYPE "ItemType" ADD VALUE 'DISNEYLAND_EVENT' BEFORE 'UNIVERSAL_PACKAGE';
ALTER TYPE "ItemType" ADD VALUE 'UNIVERSAL_EVENT' BEFORE 'DISNEY_CRUISE';
ALTER TYPE "ItemType" ADD VALUE 'SPECIAL_EVENT' BEFORE 'CRUISE';

-- AlterTable
ALTER TABLE "BookingItem" ADD COLUMN     "taxAmount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "bookingItemId" TEXT;

-- CreateTable
CREATE TABLE "BookingItemTraveler" (
    "bookingItemId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,

    CONSTRAINT "BookingItemTraveler_pkey" PRIMARY KEY ("bookingItemId","travelerId")
);

-- AddForeignKey
ALTER TABLE "BookingItemTraveler" ADD CONSTRAINT "BookingItemTraveler_bookingItemId_fkey" FOREIGN KEY ("bookingItemId") REFERENCES "BookingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItemTraveler" ADD CONSTRAINT "BookingItemTraveler_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "Traveler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_bookingItemId_fkey" FOREIGN KEY ("bookingItemId") REFERENCES "BookingItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Las reservas que ya existían incluyen a todos los viajeros de su viaje.
INSERT INTO "BookingItemTraveler" ("bookingItemId", "travelerId")
SELECT i."id", bt."travelerId"
FROM "BookingItem" i
JOIN "BookingTraveler" bt ON bt."bookingId" = i."bookingId"
ON CONFLICT DO NOTHING;
