// Sincroniza los horarios por fecha de las fichas con ThemeParks.wiki: el mes en curso y los dos
// siguientes (lo que los parques ya publicaron). En cada parque guarda el horario, el ingreso anticipado,
// el horario nocturno extendido y los precios de Lightning Lane; las noches con entrada aparte van a la
// ficha del evento. Reemplaza los días que trae la API y deja los demás (los cargados a mano).
import "server-only";
import { db } from "@/lib/db";
import { dayNote, guessEvent, type HoursDay } from "@/lib/park-hours";
import { toGuideOption } from "@/lib/park-guides";
import { matchEventGuide, matchParkGuide, parseSchedule, todayInOrlando, type ScheduleEntry } from "@/lib/park-sheet";
import { THEMEPARKS_DESTINATIONS, apiParks, localTime, resortSchedule, type ApiScheduleEntry } from "@/lib/themeparks";
import type { Destination } from "@/generated/prisma/enums";
import type { ParkGuide } from "@/generated/prisma/client";

const MONTHS_AHEAD = 3;

/** El día de un parque según la API: horario, notas y Lightning Lane, más la noche con entrada aparte si la hay. */
function dayFromApi(date: string, entries: ApiScheduleEntry[], destination: Destination) {
  const op = entries.find((e) => e.type === "OPERATING");
  if (!op) return null;
  const day: HoursDay = { date, open: localTime(op.openingTime), close: localTime(op.closingTime), earlyEntry: null, event: null, extended: null };
  let eventName = "";
  for (const e of entries) {
    const span = { open: localTime(e.openingTime), close: localTime(e.closingTime) };
    if (e.type === "TICKETED_EVENT" && e.description === "Early Entry") day.earlyEntry = span.open.replace(/^0/, "");
    else if (e.type === "TICKETED_EVENT" && e.description === "Extended Evening") day.extended = span;
    else if (e.type === "TICKETED_EVENT" && !day.event) [day.event, eventName] = [span, e.description ?? ""];
    // Universal no les pone nombre: las horas extra antes de abrir son el Early Park Admission.
    else if (e.type === "EXTRA_HOURS" && destination === "UNIVERSAL_ORLANDO" && Date.parse(e.closingTime) <= Date.parse(op.openingTime)) {
      [day.earlyEntry, day.earlyLabel] = [span.open.replace(/^0/, ""), "Early Park Admission"];
    }
  }
  const lightningLane = (op.purchases ?? [])
    .filter((p) => p.type !== "ADMISSION" && p.price?.formatted)
    .map((p) => ({ name: p.name, price: p.price!.formatted!, available: p.available ?? true }));
  const entry: ScheduleEntry = {
    date,
    openTime: day.open,
    closeTime: day.close,
    note: dayNote(day).slice(0, 200),
    ...(lightningLane.length > 0 && { lightningLane }),
    synced: true,
  };
  return { entry, event: day.event && { ...day.event, name: eventName } };
}

/** Los meses a pedir, desde el actual: [[2026, 10], [2026, 11], [2026, 12]]. */
function monthsFrom(today: string) {
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  return Array.from({ length: MONTHS_AHEAD }, (_, i) => [y + Math.floor((m - 1 + i) / 12), ((m - 1 + i) % 12) + 1] as const);
}

/** Vincula con la API las fichas de parques que todavía no tienen id, por su nombre o alias. */
async function linkParks(parks: ParkGuide[]) {
  const unlinked = parks.filter((g) => !g.apiId);
  if (unlinked.length === 0) return;
  const linked = new Set(parks.map((g) => g.apiId));
  for (const p of await apiParks()) {
    if (linked.has(p.id)) continue;
    const candidates = unlinked.filter((g) => g.destination === p.destination && !g.apiId).map(toGuideOption);
    const match = matchParkGuide(p.name, candidates);
    if (!match) continue;
    await db.parkGuide.update({ where: { id: match.id }, data: { apiId: p.id } });
    unlinked.find((g) => g.id === match.id)!.apiId = p.id;
  }
}

/** Sincroniza los horarios de todas las fichas vinculadas. Devuelve cuántos parques y días se actualizaron. */
export async function syncParkHours() {
  const guides = await db.parkGuide.findMany();
  const parks = guides.filter((g) => g.kind === "PARK" && THEMEPARKS_DESTINATIONS[g.destination]);
  if (parks.length === 0) return { parks: 0, days: 0 };
  await linkParks(parks);

  const today = todayInOrlando();
  const events = guides.filter((g) => g.kind === "EVENT").map(toGuideOption);
  const incoming = new Map<string, ScheduleEntry[]>();
  const push = (id: string, e: ScheduleEntry) => incoming.set(id, [...(incoming.get(id) ?? []), e]);
  const destinations = [...new Set(parks.filter((g) => g.apiId).map((g) => g.destination))];

  for (const destination of destinations) {
    const byApiId = new Map(parks.filter((g) => g.apiId && g.destination === destination).map((g) => [g.apiId!, g]));
    for (const [year, month] of monthsFrom(today)) {
      for (const apiPark of await resortSchedule(THEMEPARKS_DESTINATIONS[destination]!, year, month)) {
        const guide = byApiId.get(apiPark.id);
        if (!guide) continue;
        const byDate = Map.groupBy(apiPark.schedule, (e) => e.date);
        for (const [date, entries] of byDate) {
          if (date < today) continue;
          const day = dayFromApi(date, entries, destination);
          if (!day) continue;
          push(guide.id, day.entry);
          if (!day.event) continue;
          // La noche con entrada aparte, a la ficha del evento de ese parque: por su nombre (HHN) o por la temporada.
          const here = events.filter((g) => g.destination === destination && g.park?.toLowerCase() === guide.name.toLowerCase());
          const eventId = matchEventGuide(day.event.name, here)?.id || guessEvent(here, guide.name, date);
          if (eventId) push(eventId, { date, openTime: day.event.open, closeTime: day.event.close, note: "", synced: true });
        }
      }
    }
  }

  let days = 0;
  for (const g of guides) {
    const fresh = incoming.get(g.id);
    if (!fresh) continue;
    const dates = new Set(fresh.map((e) => e.date));
    const schedule = parseSchedule([...parseSchedule(g.schedule).filter((e) => !dates.has(e.date)), ...fresh]).filter((e) => e.date >= today);
    await db.parkGuide.update({ where: { id: g.id }, data: { schedule, ...(g.kind === "PARK" && { syncedAt: new Date() }) } });
    days += fresh.length;
  }
  return { parks: parks.filter((g) => incoming.has(g.id)).length, days };
}
