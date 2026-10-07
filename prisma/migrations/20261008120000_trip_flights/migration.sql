-- Los vuelos pasan a ser un dato del viaje (los agentes no los venden): los tramos se mueven
-- de la reserva de vuelo al viaje. Si hubiera más de un tramo por sentido, queda el primero.

ALTER TABLE "FlightLeg" ADD COLUMN "bookingId" TEXT;
UPDATE "FlightLeg" l SET "bookingId" = i."bookingId" FROM "BookingItem" i WHERE i."id" = l."bookingItemId";
DELETE FROM "FlightLeg" l
USING "FlightLeg" o
WHERE l."bookingId" = o."bookingId" AND l."direction" = o."direction" AND l."id" > o."id";

ALTER TABLE "FlightLeg" DROP CONSTRAINT "FlightLeg_bookingItemId_fkey";
DROP INDEX "FlightLeg_bookingItemId_direction_key";
ALTER TABLE "FlightLeg" DROP COLUMN "bookingItemId";
ALTER TABLE "FlightLeg" ALTER COLUMN "bookingId" SET NOT NULL;

CREATE UNIQUE INDEX "FlightLeg_bookingId_direction_key" ON "FlightLeg"("bookingId", "direction");
ALTER TABLE "FlightLeg" ADD CONSTRAINT "FlightLeg_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
