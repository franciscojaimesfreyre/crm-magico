-- Datos de vuelos de ida y vuelta en las reservas de vuelo.
CREATE TYPE "FlightDirection" AS ENUM ('OUTBOUND', 'RETURN');

CREATE TABLE "FlightLeg" (
    "id" TEXT NOT NULL,
    "bookingItemId" TEXT NOT NULL,
    "direction" "FlightDirection" NOT NULL,
    "date" DATE,
    "time" TEXT,
    "airline" TEXT,
    "flightNumber" TEXT,
    CONSTRAINT "FlightLeg_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FlightLeg_bookingItemId_direction_key" ON "FlightLeg"("bookingItemId", "direction");
ALTER TABLE "FlightLeg" ADD CONSTRAINT "FlightLeg_bookingItemId_fkey"
    FOREIGN KEY ("bookingItemId") REFERENCES "BookingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
