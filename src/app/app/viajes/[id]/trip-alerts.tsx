import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, Info, Lock } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui";
import { KNOWLEDGE_CATEGORY_LABEL } from "@/lib/labels";
import { daysBetween, formatDate } from "@/lib/format";
import type { TripAlert } from "@/lib/knowledge-alerts";

/** Cuándo se cruza la novedad con el viaje, en palabras. */
function overlapText(a: TripAlert) {
  if (a.wholeTrip) return "Durante todo el viaje";
  const days = daysBetween(a.from, a.to) + 1;
  const span = a.from.getTime() === a.to.getTime() ? `El ${formatDate(a.from)}` : `Del ${formatDate(a.from)} al ${formatDate(a.to)}`;
  return `${span} · ${days} ${days === 1 ? "día" : "días"} del viaje`;
}

/**
 * Avisos de novedades para las fechas del viaje. Solo los ve el agente: cierres y remodelaciones
 * que pueden complicar, y eventos, aperturas o promos que pueden sumar.
 */
export function TripAlerts({ alerts }: { alerts: TripAlert[] }) {
  const warnings = alerts.filter((a) => a.warning).length;
  return (
    <Card className="xl:col-span-2">
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            Avisos de novedades para estas fechas
            {warnings > 0 && <Badge className="bg-amber-100 text-amber-800">{warnings === 1 ? "1 a tener en cuenta" : `${warnings} a tener en cuenta`}</Badge>}
          </span>
        }
        description={
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3" /> Solo para vos: novedades cuya vigencia coincide con el viaje. El cliente no las ve.
          </span>
        }
        actions={
          <Link href="/app/novedades" className="text-xs font-medium text-brand-700 hover:underline">
            Ver novedades →
          </Link>
        }
      />
      {alerts.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No hay novedades con fechas que se crucen con este viaje.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {alerts.map((a) => {
            const Icon = a.warning ? AlertTriangle : Info;
            return (
              <li key={a.item.id}>
                <details className="group px-5 py-3">
                  <summary className="flex cursor-pointer list-none items-start gap-3">
                    <span className={clsx("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", a.warning ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700")}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800">{a.item.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <Badge className={a.warning ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-800"}>{KNOWLEDGE_CATEGORY_LABEL[a.item.category]}</Badge>
                        <span className={clsx(a.warning && "font-medium text-amber-800")}>{overlapText(a)}</span>
                        {a.item.park && <span>· {a.item.park}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 pt-1 text-xs text-brand-700 group-open:hidden">Ver más</span>
                    <span className="hidden shrink-0 pt-1 text-xs text-slate-500 group-open:inline">Ocultar</span>
                  </summary>
                  <div className="mt-2 ml-10 text-sm whitespace-pre-line text-slate-600">
                    {a.item.content}
                    {a.item.sourceUrl && (
                      <a href={a.item.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-brand-700 hover:underline">
                        Fuente
                      </a>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
