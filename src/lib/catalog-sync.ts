// Sincroniza el catálogo con ThemeParks.wiki una vez por día: vincula cada lugar con la API por su
// nombre y su parque, carga los cierres por remodelación (y los levanta cuando reabren) y guarda la
// espera típica de cada atracción. Lo que cargan los administradores a mano no se toca: la API solo
// cierra lo que no tiene cierre y solo reabre lo que cerró ella.
//
// Cuándo se da por cerrada una atracción:
// - Disney marca las remodelaciones (estado REFURBISHMENT).
// - Universal no: se mira el historial y se cierra si no funcionó ni un minuto en los últimos
//   CLOSED_DAYS días en que el parque abrió.
import "server-only";
import { db } from "@/lib/db";
import { addDays, todayUTC } from "@/lib/format";
import { normalize } from "@/lib/itinerary-checks";
import { todayInOrlando } from "@/lib/park-sheet";
import { THEMEPARKS_DESTINATIONS, parkDailyHistory, resortEntities, resortStatus, type ApiDailyRow, type ApiEntity } from "@/lib/themeparks";
import type { CatalogEntry } from "@/generated/prisma/client";
import type { Destination } from "@/generated/prisma/enums";

const CLOSED_DAYS = 3;
const HISTORY_DAYS = 6; // dentro de los 7 días de historial que da la API sin clave

const API_KINDS: Record<CatalogEntry["kind"], ApiEntity["entityType"][]> = {
  ATTRACTION: ["ATTRACTION", "SHOW"],
  SHOW: ["SHOW", "ATTRACTION"],
  RESTAURANT: ["RESTAURANT"],
  SHOPPING: [],
};

/** La entidad de la API con ese nombre: igual o, si no, la que lo contiene (o está contenida) con el largo más parecido. */
function bestMatch(name: string, candidates: ApiEntity[]) {
  const n = normalize(name);
  const exact = candidates.find((c) => normalize(c.name) === n);
  if (exact) return exact;
  return candidates
    .map((c) => ({ c, k: normalize(c.name) }))
    .filter(({ k }) => Math.min(k.length, n.length) >= 6 && (` ${k} `.includes(` ${n} `) || ` ${n} `.includes(` ${k} `)))
    .sort((a, b) => Math.abs(a.k.length - n.length) - Math.abs(b.k.length - n.length))[0]?.c;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Mediana de las esperas medianas de cada día (minutos), o null si no hubo esperas publicadas. */
function typicalWait(days: ApiDailyRow[]) {
  const waits = days.map((d) => d.standby?.p50).filter((w): w is number => typeof w === "number" && w > 0).sort((a, b) => a - b);
  return waits.length ? Math.round(waits[Math.floor(waits.length / 2)]) : null;
}

/**
 * ¿Lleva cerrada los últimos días en que abrió el parque? null si no hay datos para decidir (la API no
 * guarda historial de todo, por ejemplo de muchos restaurantes).
 */
function closedLately(days: ApiDailyRow[] | undefined, parkOpenDays: string[]) {
  if (!days || days.length === 0 || parkOpenDays.length < CLOSED_DAYS) return null;
  const minutes = new Map(days.map((d) => [d.date, d.operatingMinutes ?? 0]));
  return parkOpenDays.slice(-CLOSED_DAYS).every((date) => !minutes.get(date));
}

/** Sincroniza el catálogo de los destinos que tienen fichas de parques vinculadas con la API. */
export async function syncCatalog() {
  const guides = await db.parkGuide.findMany({ where: { kind: "PARK", apiId: { not: null } }, select: { destination: true, name: true, aliases: true, apiId: true } });
  const destinations = [...new Set(guides.map((g) => g.destination))].filter((d) => THEMEPARKS_DESTINATIONS[d]);
  const today = todayUTC();
  const parkToday = todayInOrlando();
  const r = { linked: 0, closed: [] as string[], reopened: [] as string[], unmatched: 0 };

  for (const destination of destinations) {
    const slug = THEMEPARKS_DESTINATIONS[destination]!;
    const [entities, status, entries] = await Promise.all([
      resortEntities(slug),
      resortStatus(slug),
      db.catalogEntry.findMany({ where: { destination, kind: { not: "SHOPPING" } } }),
    ]);
    const byId = new Map(entities.map((e) => [e.id, e]));
    const parks = guides.filter((g) => g.destination === destination);
    // La zona del catálogo que es un parque con ficha ("Magic Kingdom"); el resto (Disney Springs, hoteles) va contra lo que está fuera de los parques.
    const parkOf = (area: string) => parks.find((g) => [g.name, ...g.aliases].some((n) => normalize(n) === normalize(area)))?.apiId ?? null;
    const parkIds = new Set(entities.filter((e) => e.entityType === "PARK").map((e) => e.id));

    // Historial de los últimos días de cada parque (un pedido por parque).
    const from = isoDay(addDays(new Date(`${parkToday}T00:00:00Z`), -HISTORY_DAYS));
    const to = isoDay(addDays(new Date(`${parkToday}T00:00:00Z`), -1));
    const history = new Map<string, ApiDailyRow[]>();
    const openDays = new Map<string, string[]>();
    for (const g of parks) {
      try {
        const days = await parkDailyHistory(g.apiId!, from, to);
        days.forEach((v, k) => history.set(k, v));
        const open = new Set([...days.values()].flat().filter((d) => (d.operatingMinutes ?? 0) > 0).map((d) => d.date));
        openDays.set(g.apiId!, [...open].sort());
      } catch (e) {
        // Sin historial (límite por hora, caída): se sigue con el estado en vivo.
        console.error(`Historial de ${g.name} no disponible`, e);
      }
    }

    const taken = new Set(entries.map((e) => e.apiId).filter(Boolean));
    for (const e of entries) {
      let apiId = e.apiId && byId.has(e.apiId) ? e.apiId : null;
      if (!apiId) {
        const park = parkOf(e.area);
        const candidates = entities.filter(
          (x) => API_KINDS[e.kind].includes(x.entityType) && !taken.has(x.id) && (park ? x.parentId === park : !x.parentId || !parkIds.has(x.parentId)),
        );
        apiId = bestMatch(e.name, candidates)?.id ?? null;
        if (apiId) {
          taken.add(apiId);
          r.linked++;
        }
      }
      if (!apiId) {
        r.unmatched++;
        if (e.apiId) await db.catalogEntry.update({ where: { id: e.id }, data: { apiId: null } });
        continue;
      }

      const entity = byId.get(apiId)!;
      const days = history.get(apiId);
      const now = status.get(apiId);
      // Los shows no funcionan todo el día: el historial solo dice algo de las atracciones.
      const lately = e.kind === "ATTRACTION" && entity.entityType === "ATTRACTION" ? closedLately(days, openDays.get(entity.parentId ?? "") ?? []) : null;
      const closed = now === "REFURBISHMENT" || lately === true;
      const running = now === "OPERATING" || now === "DOWN" || (days?.at(-1)?.operatingMinutes ?? 0) > 0;

      const data: Partial<CatalogEntry> = { apiId, syncedAt: new Date() };
      if (e.kind === "ATTRACTION" && days) data.typicalWait = typicalWait(days);
      // Un cierre vencido (con reapertura ya pasada) cuenta como sin cierre.
      const hasClosure = !!e.closedFrom && (!e.closedTo || e.closedTo >= today);
      if (closed && !hasClosure) {
        Object.assign(data, { closedFrom: today, closedTo: null, closedByApi: true });
        r.closed.push(`${e.name} (${e.area})`);
      } else if (e.closedByApi && !closed && running) {
        Object.assign(data, { closedFrom: null, closedTo: null, closedByApi: false });
        r.reopened.push(`${e.name} (${e.area})`);
      }
      await db.catalogEntry.update({ where: { id: e.id }, data });
    }
  }
  return r;
}

/** Lugares de la API que no están en el catálogo, por parque con ficha (para sumarlos). */
export async function missingFromCatalog(destination: Destination) {
  const slug = THEMEPARKS_DESTINATIONS[destination];
  if (!slug) return [];
  const [guides, entries, entities] = await Promise.all([
    db.parkGuide.findMany({ where: { kind: "PARK", destination, apiId: { not: null } }, select: { name: true, apiId: true } }),
    db.catalogEntry.findMany({ where: { destination }, select: { apiId: true } }),
    resortEntities(slug),
  ]);
  const linked = new Set(entries.map((e) => e.apiId));
  return guides.map((g) => ({
    area: g.name,
    entities: entities
      .filter((x) => x.parentId === g.apiId && x.entityType !== "PARK" && x.entityType !== "HOTEL" && !linked.has(x.id))
      .sort((a, b) => a.entityType.localeCompare(b.entityType) || a.name.localeCompare(b.name)),
  }));
}
