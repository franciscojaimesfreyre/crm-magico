-- Las reservas de restaurantes dejan de ser una sección aparte: se pasan a las notas del viaje,
-- que la IA usa al proponer el itinerario.
UPDATE "Booking" b
SET "notes" = concat_ws(E'\n\n', NULLIF(b."notes", ''), E'Restaurantes reservados:\n' || agg.lines)
FROM (
  SELECT "bookingId",
         string_agg(
           '- ' || "restaurant" || ' · ' || to_char("dateTime", 'DD/MM/YYYY HH24:MI') || ' h'
             || coalesce(' · ' || "partySize"::text || ' personas', '')
             || coalesce(' · Conf. ' || "confirmationNumber", '')
             || coalesce(' · ' || "notes", ''),
           E'\n' ORDER BY "dateTime"
         ) AS lines
  FROM "DiningReservation"
  GROUP BY "bookingId"
) agg
WHERE b."id" = agg."bookingId";

DROP TABLE "DiningReservation";
