// Fichas base de parques y eventos (catálogo) y los eventos especiales reservados en un viaje.
import "server-only";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/format";
import { ITEM_TYPE_BASE, itemBrand } from "@/lib/labels";
import { matchEventGuide, parseSections, type GuideOption, type TripEvent } from "@/lib/park-sheet";
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
export function tripEvents(
  items: { type: ItemType; status: string; description: string; supplier?: string | null; startDate: Date | null }[],
  guides: GuideOption[],
): TripEvent[] {
  return items.flatMap((i) => {
    if (i.status === "CANCELLED" || !i.startDate || ITEM_TYPE_BASE[i.type] !== "SPECIAL_EVENT") return [];
    const brand = itemBrand(i.type);
    const guide = matchEventGuide(`${i.description} ${i.supplier ?? ""}`, guides, brand ? EVENT_DESTINATION[brand] : undefined);
    return guide ? [{ date: toDateInput(i.startDate), guideId: guide.id, title: i.description }] : [];
  });
}
