import { db } from "@/lib/db";
import { calendarEvents } from "@/lib/calendar";
import { addDays, todayUTC } from "@/lib/format";

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

/** Feed iCal privado de la organización (eventos de todo el día). */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const org = await db.organization.findUnique({ where: { icalToken: token } });
  if (!org) return new Response("No encontrado", { status: 404 });
  const today = todayUTC();
  const events = await calendarEvents(org.id, addDays(today, -60), addDays(today, 365));
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CRM Magico//ES",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escape(org.name)} — CRM`,
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.id}@crm-magico`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(e.date, 1))}`,
      `SUMMARY:${escape(e.title)}`,
      `URL:${appUrl}${e.href}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" },
  });
}
