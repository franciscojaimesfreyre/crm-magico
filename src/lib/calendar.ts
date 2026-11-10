import "server-only";
import { agenda } from "@/lib/agenda";

export type CalendarEvent = {
  id: string;
  date: Date; // medianoche UTC
  title: string;
  href: string;
};

/**
 * Eventos de la organización entre dos fechas (inclusive), para el feed de Google/Apple/Outlook. Salen de la
 * misma agenda que el calendario; los ids no cambian (si cambian, los eventos se duplican en los calendarios
 * suscriptos).
 */
export async function calendarEvents(organizationId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  const entries = await agenda({ organizationId, userId: "", from, to, scope: "all", showEnds: true });
  return entries.map((e) => ({
    id: e.id,
    date: e.date,
    title: [e.who, e.booking?.code, e.kind === "task" ? `Tarea: ${e.label}` : e.label, e.tentative ? "(tentativo)" : null].filter(Boolean).join(" · "),
    href: e.href,
  }));
}
