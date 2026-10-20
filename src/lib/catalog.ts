import "server-only";
// Catálogo de parques: lo que existe de verdad en cada destino (atracciones con altura mínima, shows,
// restaurantes y shoppings con su nivel de precio). Lo mantiene el equipo de la plataforma y la IA lo
// usa para no inventar lugares y para saber a qué puede subir cada viajero.
import { db } from "@/lib/db";
import { ageOn, toDateInput } from "@/lib/format";
import { DINING_STYLE_LABEL, itemBrand, priceSigns } from "@/lib/labels";
import type { CatalogEntry } from "@/generated/prisma/client";
import type { Destination } from "@/generated/prisma/enums";
import { entriesNamedIn, normalize, type CheckEntry, type CheckTraveler, type Closure } from "@/lib/itinerary-checks";

/** Altura mínima en cm (redondeada hacia arriba, para no dejar subir a quien no llega). */
export const inchesToCm = (inches: number) => Math.ceil(inches * 2.54);

export function heightLabel(inches: number | null) {
  return inches ? `${inchesToCm(inches)} cm (${inches}")` : "";
}

/** ¿Está cerrada en algún momento entre esas fechas? Sin fechas, se mira el día de hoy. */
export function closedDuring(e: Pick<CatalogEntry, "closedFrom" | "closedTo">, from: Date, to: Date) {
  if (!e.closedFrom) return false;
  return e.closedFrom <= to && (!e.closedTo || e.closedTo >= from);
}

export function closureLabel(e: Pick<CatalogEntry, "closedFrom" | "closedTo"> & { closedByApi?: boolean }) {
  if (!e.closedFrom) return "";
  return `cerrada desde ${toDateInput(e.closedFrom)}${e.closedTo ? ` hasta ${toDateInput(e.closedTo)}` : " (sin fecha de reapertura confirmada)"}${e.closedByApi ? " según ThemeParks.wiki" : ""}`;
}

/**
 * Cierres que salen de las novedades de cierre o remodelación (globales y de la agencia), por id de
 * atracción del catálogo: las elegidas en la novedad o, si no se eligieron a mano, las que nombra su título.
 */
export async function knowledgeClosures(organizationId: string | null, entries: { id: string; name: string }[]) {
  const out = new Map<string, Closure[]>();
  if (entries.length === 0) return out;
  const items = await db.knowledgeItem.findMany({
    where: {
      published: true,
      category: { in: ["CLOSURE", "REFURBISHMENT"] },
      OR: [{ organizationId: null }, ...(organizationId ? [{ organizationId }] : [])],
    },
    select: { title: true, validFrom: true, validTo: true, closesEntryIds: true, closesManual: true },
  });
  for (const k of items) {
    const ids = k.closesManual ? k.closesEntryIds : entriesNamedIn(k.title, entries).map((e) => e.id);
    const closure = { from: k.validFrom ? toDateInput(k.validFrom) : null, to: k.validTo ? toDateInput(k.validTo) : null, reason: k.title };
    for (const id of ids) out.set(id, [...(out.get(id) ?? []), closure]);
  }
  return out;
}

/** Cierre cargado en la atracción del catálogo, en el mismo formato que los de las novedades. */
const entryClosures = (e: Pick<CatalogEntry, "closedFrom" | "closedTo" | "closedByApi">): Closure[] =>
  e.closedFrom ? [{ from: toDateInput(e.closedFrom), to: e.closedTo ? toDateInput(e.closedTo) : null, reason: e.closedByApi ? "según ThemeParks.wiki" : null }] : [];

const KIND_HEADING = { ATTRACTION: "Atracciones", SHOW: "Shows", RESTAURANT: "Restaurantes", SHOPPING: "Shoppings" } as const;

const ORLANDO: Destination[] = ["DISNEY_WORLD", "UNIVERSAL_ORLANDO"];

/** Destinos del catálogo que corresponden a un viaje: su destino y las marcas de sus reservas. */
export function catalogDestinations(trip: { destination: Destination; items: { type: string; status: string }[] }) {
  const set = new Set<Destination>();
  if (trip.destination !== "COMBINED" && trip.destination !== "OTHER") set.add(trip.destination);
  for (const i of trip.items) {
    if (i.status === "CANCELLED") continue;
    const brand = itemBrand(i.type);
    if (brand === "DISNEY_WORLD") set.add("DISNEY_WORLD");
    if (brand === "UNIVERSAL") set.add(trip.destination === "UNIVERSAL_HOLLYWOOD" ? "UNIVERSAL_HOLLYWOOD" : "UNIVERSAL_ORLANDO");
    if (brand === "DISNEYLAND") set.add("DISNEYLAND");
  }
  // Un combinado sin reservas de marca suele ser Disney + Universal en Orlando.
  if (trip.destination === "COMBINED" && set.size === 0) ORLANDO.forEach((d) => set.add(d));
  return [...set];
}

type TripForCatalog = {
  /** Para sumar los cierres de las novedades de la agencia (las globales van siempre). */
  organizationId?: string;
  destination: Destination;
  startDate: Date | null;
  endDate: Date | null;
  items: { type: string; status: string }[];
};

/**
 * Lo que la IA recibe del catálogo para un viaje: los lugares que existen (agrupados por parque o
 * zona), con sus imperdibles. Las alturas no van en números (las revisa el sistema en el editor):
 * attractionNote puede sumar a cada atracción una nota ya calculada, como quién no llega.
 * Devuelve null si no hay catálogo para el destino.
 */
export async function catalogForTrip(trip: TripForCatalog, attractionNote?: (e: CatalogEntry) => string | null) {
  const destinations = catalogDestinations(trip);
  if (destinations.length === 0) return null;
  // Los shoppings de Orlando sirven para cualquier viaje a Orlando, sea de Disney o de Universal.
  const orlando = destinations.some((d) => ORLANDO.includes(d));
  const entries = await db.catalogEntry.findMany({
    where: {
      OR: [{ destination: { in: destinations } }, ...(orlando ? [{ destination: { in: ORLANDO }, kind: "SHOPPING" as const }] : [])],
    },
    orderBy: [{ destination: "asc" }, { area: "asc" }, { kind: "asc" }, { name: "asc" }],
  });
  if (entries.length === 0) return null;

  const from = trip.startDate ?? new Date();
  const to = trip.endDate ?? from;
  // Cierres de las novedades que se cruzan con el viaje (además de los cargados en el catálogo).
  const news = await knowledgeClosures(trip.organizationId ?? null, entries);
  const [fromIso, toIso] = [toDateInput(from), toDateInput(to)];
  const newsClosure = (e: CatalogEntry) => news.get(e.id)?.find((c) => (!c.from || c.from <= toIso) && (!c.to || c.to >= fromIso));
  const isClosed = (e: CatalogEntry) => closedDuring(e, from, to) || !!newsClosure(e);
  const open = entries.filter((e) => !isClosed(e));
  const closed = entries.filter(isClosed);

  const describe = (e: CatalogEntry) => {
    const meta = [
      e.mustDo && "IMPERDIBLE",
      e.kind === "ATTRACTION" && attractionNote?.(e),
      e.typicalWait && `espera típica ${e.typicalWait} min`,
      e.diningStyle && DINING_STYLE_LABEL[e.diningStyle].toLowerCase(),
      e.priceLevel && priceSigns(e.priceLevel),
      e.notes,
    ].filter(Boolean);
    return `  - ${e.name}${meta.length ? ` (${meta.join("; ")})` : ""}`;
  };
  const byArea = new Map<string, CatalogEntry[]>();
  for (const e of open) byArea.set(e.area, [...(byArea.get(e.area) ?? []), e]);
  const places = [...byArea.entries()]
    .map(([area, list]) => {
      const kinds = (["ATTRACTION", "SHOW", "RESTAURANT", "SHOPPING"] as const)
        .map((k) => {
          const of = list.filter((e) => e.kind === k);
          return of.length ? `${KIND_HEADING[k]}:\n${of.map(describe).join("\n")}` : null;
        })
        .filter(Boolean);
      return `## ${area}\n${kinds.join("\n")}`;
    })
    .join("\n\n");
  const closedText = closed.length
    ? `\n\nCerradas en las fechas del viaje (no incluirlas):\n${closed
        .map((e) => {
          // Si la novedad trae fecha de reapertura, manda sobre un cierre del catálogo sin fecha.
          const c = newsClosure(e);
          const fromNews = c && (c.to || !closedDuring(e, from, to));
          const label = fromNews ? `según la novedad «${c.reason}»${c.to ? `, hasta ${c.to}` : ""}` : closureLabel(e);
          return `- ${e.name} (${e.area}): ${label}${e.notes ? `. ${e.notes}` : ""}`;
        })
        .join("\n")}`
    : "";

  return places + closedText;
}

/** Atracciones y shows del catálogo para la revisión automática del editor de itinerarios. */
export async function catalogChecks(destinations: Destination[], organizationId: string | null = null): Promise<CheckEntry[]> {
  if (destinations.length === 0) return [];
  const entries = await db.catalogEntry.findMany({
    where: { destination: { in: destinations }, kind: { in: ["ATTRACTION", "SHOW"] } },
    orderBy: [{ area: "asc" }, { name: "asc" }],
  });
  const news = await knowledgeClosures(organizationId, entries);
  return entries.map((e) => ({
    id: e.id,
    kind: e.kind as CheckEntry["kind"],
    area: e.area,
    name: e.name,
    minHeightIn: e.minHeightIn,
    mustDo: e.mustDo,
    closures: [...entryClosures(e), ...(news.get(e.id) ?? [])],
    notes: e.notes,
  }));
}

/** Solo las atracciones con algún cierre (para marcarlas en las fichas del itinerario que ve el viajero). */
export async function closedEntries(destinations: Destination[], organizationId: string | null) {
  return (await catalogChecks(destinations, organizationId)).filter((e) => e.closures.length > 0);
}

/** Atracciones con cierres para el itinerario de un viaje (destino y marcas de sus reservas, novedades de su agencia). */
export async function bookingClosures(bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { organizationId: true, destination: true, items: { select: { type: true, status: true } } } });
  return b ? closedEntries(catalogDestinations(b), b.organizationId) : [];
}

/** Viajeros de un viaje, con la altura y la edad al viajar, para la revisión de alturas. */
export function checkTravelers(
  travelers: { traveler: { firstName: string; heightCm: number | null; birthDate: Date | null } }[],
  at: Date | null,
): CheckTraveler[] {
  return travelers.map(({ traveler: t }) => ({ name: t.firstName, heightCm: t.heightCm, age: ageOn(t.birthDate, at ?? new Date()) }));
}

/**
 * Parque (zona del catálogo) al que se refiere una actividad del itinerario, por su título o su lugar,
 * y lo que está abierto ahí ese día. Gana el nombre de zona más largo ("Animal Kingdom Lodge" antes
 * que "Animal Kingdom"). Devuelve null si el catálogo no tiene ese lugar.
 */
export async function catalogForPlace(trip: TripForCatalog, place: { title: string; location: string | null; date: string | null }) {
  const destinations = catalogDestinations(trip);
  if (destinations.length === 0) return null;
  const entries = await db.catalogEntry.findMany({
    where: { destination: { in: destinations } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  const haystacks = [place.title, place.location ?? ""].map((t) => ` ${normalize(t)} `);
  let area: string | null = null;
  for (const text of haystacks) {
    for (const a of new Set(entries.map((e) => e.area))) {
      const name = normalize(a);
      if (name.length >= 4 && text.includes(` ${name} `) && (!area || name.length > normalize(area).length)) area = a;
    }
    if (area) break;
  }
  if (!area) return null;
  const day = place.date ? new Date(`${place.date}T00:00:00.000Z`) : (trip.startDate ?? new Date());
  return { area, entries: entries.filter((e) => e.area === area && !closedDuring(e, day, day)) };
}
