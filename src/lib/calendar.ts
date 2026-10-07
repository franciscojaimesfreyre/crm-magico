import "server-only";
import { db } from "@/lib/db";
import { computeKeyDates } from "@/lib/key-dates";
import { addDays } from "@/lib/format";

export type CalendarEvent = {
  id: string;
  date: Date; // medianoche UTC
  title: string;
  kind: "trip" | "keydate" | "task";
  href: string;
};

/** Eventos de la organización entre dos fechas (inclusive). */
export async function calendarEvents(organizationId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  const [bookings, tasks] = await Promise.all([
    db.booking.findMany({
      where: {
        organizationId,
        status: { not: "CANCELLED" },
        OR: [
          { startDate: { gte: addDays(from, -90), lte: addDays(to, 90) } },
          { items: { some: { balanceDue: { gte: from, lte: to } } } },
          { items: { some: { startDate: { gte: addDays(from, -90), lte: addDays(to, 90) } } } },
        ],
      },
      include: { client: { select: { firstName: true, lastName: true } }, items: true, flightLegs: true },
    }),
    db.task.findMany({ where: { organizationId, completedAt: null, dueDate: { gte: from, lte: to } } }),
  ]);
  const events: CalendarEvent[] = [];
  for (const b of bookings) {
    const who = `${b.client.firstName} ${b.client.lastName}`;
    for (const k of computeKeyDates(b)) {
      if (k.date < from || k.date > to) continue;
      const isTrip = k.kind === "checkin" || k.kind === "checkout";
      events.push({
        id: `${b.id}-${k.kind}-${k.label}`,
        date: k.date,
        title: isTrip ? `${k.kind === "checkin" ? "✈️ Sale" : "🏠 Vuelve"}: ${who}` : `${k.label} — ${who}`,
        kind: isTrip ? "trip" : "keydate",
        href: `/app/viajes/${b.id}`,
      });
    }
  }
  for (const t of tasks) {
    events.push({ id: t.id, date: t.dueDate!, title: `☑ ${t.title}`, kind: "task", href: t.bookingId ? `/app/viajes/${t.bookingId}?tab=tareas` : "/app/tareas" });
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
