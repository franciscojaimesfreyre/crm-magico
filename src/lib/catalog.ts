import "server-only";
// Catálogo de parques: lo que existe de verdad en cada destino (atracciones con altura mínima, shows,
// restaurantes y shoppings con su nivel de precio). Lo mantiene el equipo de la plataforma y la IA lo
// usa para no inventar lugares y para saber a qué puede subir cada viajero.
import { db } from "@/lib/db";
import { ageOn, toDateInput } from "@/lib/format";
import { DINING_STYLE_LABEL, itemBrand, priceSigns } from "@/lib/labels";
import type { CatalogEntry } from "@/generated/prisma/client";
import type { Destination } from "@/generated/prisma/enums";
import type { CheckEntry, CheckTraveler } from "@/lib/itinerary-checks";

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

export function closureLabel(e: Pick<CatalogEntry, "closedFrom" | "closedTo">) {
  if (!e.closedFrom) return "";
  return `cerrada desde ${toDateInput(e.closedFrom)}${e.closedTo ? ` hasta ${toDateInput(e.closedTo)}` : " (sin fecha de reapertura confirmada)"}`;
}

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
  destination: Destination;
  startDate: Date | null;
  endDate: Date | null;
  items: { type: string; status: string }[];
};

/**
 * Lo que la IA recibe del catálogo para un viaje: los lugares que existen (agrupados por parque o
 * zona), con sus imperdibles. Las alturas no: las revisa el sistema en el editor (itinerary-checks).
 * Devuelve null si no hay catálogo para el destino.
 */
export async function catalogForTrip(trip: TripForCatalog) {
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
  const open = entries.filter((e) => !closedDuring(e, from, to));
  const closed = entries.filter((e) => closedDuring(e, from, to));

  const describe = (e: CatalogEntry) => {
    const meta = [
      e.mustDo && "IMPERDIBLE",
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
    ? `\n\nCerradas en las fechas del viaje (no incluirlas):\n${closed.map((e) => `- ${e.name} (${e.area}): ${closureLabel(e)}${e.notes ? `. ${e.notes}` : ""}`).join("\n")}`
    : "";

  return places + closedText;
}

/** Atracciones y shows del catálogo para la revisión automática del editor de itinerarios. */
export async function catalogChecks(destinations: Destination[]): Promise<CheckEntry[]> {
  if (destinations.length === 0) return [];
  const entries = await db.catalogEntry.findMany({
    where: { destination: { in: destinations }, kind: { in: ["ATTRACTION", "SHOW"] } },
    orderBy: [{ area: "asc" }, { name: "asc" }],
  });
  return entries.map((e) => ({
    id: e.id,
    kind: e.kind as CheckEntry["kind"],
    area: e.area,
    name: e.name,
    minHeightIn: e.minHeightIn,
    mustDo: e.mustDo,
    closedFrom: e.closedFrom ? toDateInput(e.closedFrom) : null,
    closedTo: e.closedTo ? toDateInput(e.closedTo) : null,
    notes: e.notes,
  }));
}

/** Viajeros de un viaje, con la altura y la edad al viajar, para la revisión de alturas. */
export function checkTravelers(
  travelers: { traveler: { firstName: string; heightCm: number | null; birthDate: Date | null } }[],
  at: Date | null,
): CheckTraveler[] {
  return travelers.map(({ traveler: t }) => ({ name: t.firstName, heightCm: t.heightCm, age: ageOn(t.birthDate, at ?? new Date()) }));
}
