// Fichas base de parques y eventos (catálogo) y los eventos especiales reservados en un viaje.
import "server-only";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/format";
import { ITEM_TYPE_BASE, itemBrand } from "@/lib/labels";
import { matchEventGuide, parseSchedule, parseSections, type GuideOption, type TripEvent } from "@/lib/park-sheet";
import type { Destination, ItemType } from "@/generated/prisma/enums";
import type { ParkGuide } from "@/generated/prisma/client";

export function toGuideOption(g: ParkGuide): GuideOption {
  return {
    id: g.id,
    kind: g.kind,
    destination: g.destination,
    name: g.name,
    park: g.park,
    aliases: g.aliases,
    openTime: g.openTime,
    closeTime: g.closeTime,
    hoursNote: g.hoursNote,
    arrival: g.arrival,
    mainShow: g.mainShow,
    sections: parseSections(g.sections),
    schedule: parseSchedule(g.schedule),
  };
}

/** Fichas publicadas, primero las de los destinos del viaje (si se pasan). */
export async function guideOptions(destinations: Destination[] = []): Promise<GuideOption[]> {
  const guides = await db.parkGuide.findMany({ where: { published: true }, orderBy: [{ kind: "asc" }, { position: "asc" }, { name: "asc" }] });
  const rank = (d: Destination) => (destinations.includes(d) ? 0 : 1);
  return guides.sort((a, b) => rank(a.destination) - rank(b.destination)).map(toGuideOption);
}

const EVENT_DESTINATION: Record<string, Destination[]> = {
  DISNEY_WORLD: ["DISNEY_WORLD"],
  DISNEYLAND: ["DISNEYLAND"],
  UNIVERSAL: ["UNIVERSAL_ORLANDO", "UNIVERSAL_HOLLYWOOD"],
};

/**
 * Eventos especiales reservados en el viaje (fiesta de Halloween, de Navidad, After Hours…), con la
 * ficha del catálogo que les corresponde según la descripción de la reserva.
 */
/** La ficha del evento especial que nombra una reserva de tipo evento (null si no es evento o no se reconoce). */
export function eventGuideFor(i: { type: ItemType; description: string; supplier?: string | null }, guides: GuideOption[]) {
  if (ITEM_TYPE_BASE[i.type] !== "SPECIAL_EVENT") return null;
  const brand = itemBrand(i.type);
  return matchEventGuide(`${i.description} ${i.supplier ?? ""}`, guides, brand ? EVENT_DESTINATION[brand] : undefined);
}

export function tripEvents(
  items: { type: ItemType; status: string; description: string; supplier?: string | null; startDate: Date | null }[],
  guides: GuideOption[],
): TripEvent[] {
  return items.flatMap((i) => {
    if (i.status === "CANCELLED" || !i.startDate) return [];
    const guide = eventGuideFor(i, guides);
    return guide ? [{ date: toDateInput(i.startDate), guideId: guide.id, title: i.description }] : [];
  });
}
