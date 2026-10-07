import "server-only";
import { db } from "@/lib/db";
import { computeKeyDates } from "@/lib/key-dates";
import { addDays } from "@/lib/format";

export type CalendarEvent = {
  id: string;
  date: Date; // medianoche UTC
  title: string;
  kind: "trip" | "keydate" | "task" | "dining";
  href: string;
};

/** Eventos de la organización entre dos fechas (inclusive). */
export async function calendarEvents(organizationId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  const [bookings, tasks, dining] = await Promise.all([
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
      include: { client: { select: { firstName: true, lastName: true } }, items: { include: { flightLegs: true } } },
    }),
    db.task.findMany({ where: { organizationId, completedAt: null, dueDate: { gte: from, lte: to } } }),
    db.diningReservation.findMany({
      where: { booking: { organizationId }, dateTime: { gte: from, lt: addDays(to, 1) } },
      include: { booking: { include: { client: { select: { lastName: true } } } } },
    }),
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
  for (const d of dining) {
    const day = new Date(Date.UTC(d.dateTime.getUTCFullYear(), d.dateTime.getUTCMonth(), d.dateTime.getUTCDate()));
    events.push({
      id: d.id,
      date: day,
      title: `🍽 ${d.dateTime.toISOString().slice(11, 16)} ${d.restaurant} (${d.booking.client.lastName})`,
      kind: "dining",
      href: `/app/viajes/${d.bookingId}`,
    });
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
