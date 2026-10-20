// Sincronización diaria con ThemeParks.wiki: primero los horarios de las fichas (que vinculan cada
// parque con la API) y después el catálogo de cada parque vinculado.
import "server-only";
import { db } from "@/lib/db";
import { syncCatalog } from "@/lib/catalog-sync";
import { syncParkHours } from "@/lib/park-hours-sync";

const HOUR = 60 * 60 * 1000;

export async function syncThemeParks() {
  const hours = await syncParkHours();
  const catalog = await syncCatalog();
  return { hours, catalog };
}

let lastAttempt = 0;

/** Sincroniza si pasaron más de 12 horas desde la última vez (y nunca más de un intento por hora). */
export async function syncThemeParksIfDue() {
  if (Date.now() - lastAttempt < HOUR) return;
  lastAttempt = Date.now();
  const last = await db.parkGuide.aggregate({ where: { kind: "PARK" }, _max: { syncedAt: true } });
  if (last._max.syncedAt && Date.now() - last._max.syncedAt.getTime() < 12 * HOUR) return;
  await syncThemeParks();
}
