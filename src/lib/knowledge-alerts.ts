// Novedades para el agente fuera de la sección Novedades: la selección del inicio (vigentes y
// próximas) y los avisos de un viaje (las que tienen fechas que se cruzan con las del viaje).
import "server-only";
import { db } from "@/lib/db";
import { addDays, daysBetween, todayUTC } from "@/lib/format";
import { catalogDestinations } from "@/lib/catalog";
import type { KnowledgeItem } from "@/generated/prisma/client";
import type { Destination, KnowledgeCategory } from "@/generated/prisma/enums";

const visibleTo = (organizationId: string) => ({ published: true, OR: [{ organizationId: null }, { organizationId }] });

/** Las que avisan de algo que puede complicar el viaje; el resto (eventos, aperturas, promos) son oportunidades. */
const WARNING_CATEGORIES: KnowledgeCategory[] = ["CLOSURE", "REFURBISHMENT", "RULE_CHANGE", "PRICING"];
export const isWarning = (category: KnowledgeCategory) => WARNING_CATEGORIES.includes(category);

/**
 * Selección para el inicio: las vigentes hoy (fijadas y las que empezaron hace poco) y las que empiezan
 * en los próximos meses, ordenadas por fecha de inicio.
 */
export async function knowledgeHighlights(organizationId: string, opts = { current: 3, upcoming: 4 }) {
  const today = todayUTC();
  const items = await db.knowledgeItem.findMany({
    where: { ...visibleTo(organizationId), AND: [{ OR: [{ validTo: null }, { validTo: { gte: today } }] }] },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });
  const upcoming = items
    .filter((k) => k.validFrom && k.validFrom > today && k.validFrom <= addDays(today, 120))
    .sort((a, b) => a.validFrom!.getTime() - b.validFrom!.getTime());
  // Vigentes: con fechas y ya empezadas, o sin fechas pero fijadas o recientes (las otras son material de consulta).
  const current = items
    .filter((k) => (k.validFrom ? k.validFrom <= today : k.validTo !== null || k.pinned || daysBetween(k.createdAt, today) <= 30))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.validFrom ?? b.createdAt).getTime() - (a.validFrom ?? a.createdAt).getTime());
  return {
    current: current.slice(0, opts.current),
    upcoming: upcoming.slice(0, opts.upcoming),
    total: items.length,
  };
}

export type TripAlert = {
  item: KnowledgeItem;
  warning: boolean;
  /** Días del viaje que abarca la novedad. */
  from: Date;
  to: Date;
  wholeTrip: boolean;
};

type TripLike = { organizationId: string; destination: Destination; startDate: Date | null; endDate: Date | null; items: { type: string; status: string }[] };

/**
 * Avisos de un viaje con fechas: novedades con vigencia que se superpone con el viaje, para su destino
 * (o los de sus reservas) o generales. Primero las que pueden complicar (cierres, remodelaciones…).
 */
export async function tripKnowledgeAlerts(trip: TripLike): Promise<TripAlert[] | null> {
  const { startDate: start, endDate: end } = trip;
  if (!start || !end) return null;
  const destinations = catalogDestinations(trip);
  const items = await db.knowledgeItem.findMany({
    where: {
      ...visibleTo(trip.organizationId),
      AND: [
        { OR: [{ validFrom: { not: null } }, { validTo: { not: null } }] },
        { OR: [{ validFrom: null }, { validFrom: { lte: end } }] },
        { OR: [{ validTo: null }, { validTo: { gte: start } }] },
        destinations.length ? { OR: [{ destinations: { isEmpty: true } }, { destinations: { hasSome: destinations } }] } : {},
      ],
    },
    orderBy: [{ pinned: "desc" }, { validFrom: "asc" }],
    take: 50,
  });
  return items
    .map((item) => {
      const from = item.validFrom && item.validFrom > start ? item.validFrom : start;
      const to = item.validTo && item.validTo < end ? item.validTo : end;
      return { item, warning: isWarning(item.category), from, to, wholeTrip: from.getTime() === start.getTime() && to.getTime() === end.getTime() };
    })
    .sort((a, b) => Number(b.warning) - Number(a.warning) || a.from.getTime() - b.from.getTime());
}
