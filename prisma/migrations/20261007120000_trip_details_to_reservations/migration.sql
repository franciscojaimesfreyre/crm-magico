-- El viaje deja de tener datos de hotel y parques: esa información vive en sus reservas.
-- Para no perder lo que ya estaba cargado, se agrega a las notas internas del viaje.

UPDATE "Booking"
SET "notes" = concat_ws(E'\n\n', NULLIF("notes", ''), 'Datos que estaban cargados en el viaje: ' || concat_ws(' · ',
    CASE WHEN "resort" IS NOT NULL THEN 'Hotel: ' || "resort" END,
    CASE WHEN "roomType" IS NOT NULL THEN 'Habitación: ' || "roomType" END,
    CASE WHEN "ticketType" IS NOT NULL THEN 'Entradas: ' || "ticketType" END,
    CASE WHEN "parkDays" IS NOT NULL THEN 'Días de parque: ' || "parkDays" END,
    CASE WHEN "lightningLane" THEN 'Lightning Lane' END,
    CASE WHEN "memoryMaker" THEN 'Memory Maker' END,
    CASE WHEN "diningPlan" IS NOT NULL THEN 'Plan de comidas: ' || "diningPlan" END))
WHERE "resort" IS NOT NULL OR "roomType" IS NOT NULL OR "ticketType" IS NOT NULL OR "parkDays" IS NOT NULL
   OR "lightningLane" OR "memoryMaker" OR "diningPlan" IS NOT NULL;

ALTER TABLE "Booking"
  DROP COLUMN "resort",
  DROP COLUMN "roomType",
  DROP COLUMN "ticketType",
  DROP COLUMN "parkDays",
  DROP COLUMN "lightningLane",
  DROP COLUMN "memoryMaker",
  DROP COLUMN "diningPlan";
