-- Catálogo de parques: atracciones, shows, restaurantes y shoppings (lo mantiene la plataforma).
CREATE TYPE "CatalogKind" AS ENUM ('ATTRACTION', 'SHOW', 'RESTAURANT', 'SHOPPING');
CREATE TYPE "DiningStyle" AS ENUM ('TABLE_SERVICE', 'QUICK_SERVICE', 'CHARACTER_DINING', 'SIGNATURE', 'LOUNGE', 'SNACK');

CREATE TABLE "CatalogEntry" (
    "id" TEXT NOT NULL,
    "kind" "CatalogKind" NOT NULL,
    "destination" "Destination" NOT NULL,
    "area" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minHeightIn" INTEGER,
    "diningStyle" "DiningStyle",
    "priceLevel" INTEGER,
    "mustDo" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "closedFrom" DATE,
    "closedTo" DATE,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CatalogEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogEntry_destination_area_name_key" ON "CatalogEntry"("destination", "area", "name");
CREATE INDEX "CatalogEntry_destination_kind_idx" ON "CatalogEntry"("destination", "kind");
