import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { CopyText } from "@/app/app/clientes/[id]/client-widgets";
import { calendarEvents, type CalendarEvent } from "@/lib/calendar";
import { addDays, todayUTC } from "@/lib/format";
import { appUrl } from "@/lib/app-url";

export const metadata = { title: "Calendario" };

const KIND_STYLE: Record<CalendarEvent["kind"], string> = {
  trip: "bg-brand-100 text-brand-800",
  keydate: "bg-amber-100 text-amber-800",
  task: "bg-slate-100 text-slate-700",
};
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const user = await requireUser();
  const { mes } = await searchParams;
  const today = todayUTC();
  const [y, m] = mes && /^\d{4}-\d{2}$/.test(mes) ? mes.split("-").map(Number) : [today.getUTCFullYear(), today.getUTCMonth() + 1];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  // La grilla arranca el lunes anterior al día 1 y termina el domingo posterior al último día.
  const start = addDays(first, -((first.getUTCDay() + 6) % 7));
  const end = addDays(last, 6 - ((last.getUTCDay() + 6) % 7));
  const events = await calendarEvents(user.organizationId, start, end);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const k = e.date.toISOString().slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const monthKey = (date: Date) => date.toISOString().slice(0, 7);
  const title = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const icalUrl = `${appUrl()}/api/ical/${user.organization.icalToken}`;

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Salidas, regresos, aperturas de reservas, vencimientos de pago, restaurantes y tareas."
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/app/calendario?mes=${monthKey(addDays(first, -1))}`} className={buttonClass("secondary", "sm")}>
              <ChevronLeft className="size-4" />
            </Link>
            <span className="w-40 text-center font-medium text-slate-800 first-letter:uppercase">{title}</span>
            <Link href={`/app/calendario?mes=${monthKey(addDays(last, 1))}`} className={buttonClass("secondary", "sm")}>
              <ChevronRight className="size-4" />
            </Link>
            <Link href="/app/calendario" className={buttonClass("ghost", "sm")}>
              Hoy
            </Link>
          </div>
        }
      />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = d.toISOString().slice(0, 10);
            const list = byDay.get(key) ?? [];
            const inMonth = d.getUTCMonth() === m - 1;
            const isToday = key === today.toISOString().slice(0, 10);
            return (
              <div key={key} className={clsx("min-h-28 border-r border-b border-slate-100 p-1.5", !inMonth && "bg-slate-50/60")}>
                <p className={clsx("mb-1 text-right text-xs", isToday ? "font-bold text-brand-700" : inMonth ? "text-slate-500" : "text-slate-300")}>
                  {isToday ? <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-white">{d.getUTCDate()}</span> : d.getUTCDate()}
                </p>
                <div className="space-y-1">
                  {list.slice(0, 4).map((e) => (
                    <Link key={e.id} href={e.href} className={clsx("block truncate rounded px-1.5 py-0.5 text-[11px]", KIND_STYLE[e.kind])} title={e.title}>
                      {e.title}
                    </Link>
                  ))}
                  {list.length > 4 && <p className="px-1 text-[11px] text-slate-400">+{list.length - 4} más</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div>
          <p className="font-medium text-slate-800">Sincronizá con Google, Apple u Outlook</p>
          <p className="text-xs text-slate-500">Suscribite a este link desde tu calendario (“Agregar calendario desde URL”). Es privado: no lo compartas.</p>
          <code className="mt-1 block text-xs text-slate-600">{icalUrl}</code>
        </div>
        <CopyText text={icalUrl} label="Copiar link" />
      </Card>
    </>
  );
}
