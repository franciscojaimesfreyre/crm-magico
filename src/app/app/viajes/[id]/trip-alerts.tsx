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
  const warningsList = alerts.filter((a) => a.warning);
  const others = alerts.filter((a) => !a.warning);
  const warnings = warningsList.length;
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
        <p className="p-5 text-sm text-[var(--ink-soft)]">No hay novedades con fechas que se crucen con este viaje.</p>
      ) : (
        <>
          {/* A la vista, lo que puede complicar el viaje; los eventos y aperturas, plegados en una línea. */}
          {warningsList.length > 0 && <ul className="divide-y divide-[var(--rule)]">{warningsList.map((a) => <AlertRow key={a.item.id} alert={a} />)}</ul>}
          {others.length > 0 && (
            <details className="group border-t border-[var(--rule)]">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm text-slate-700 hover:bg-[var(--raised)]">
                <Info className="size-4 shrink-0 text-sky-700" />
                <span className="flex-1">
                  {others.length} {others.length === 1 ? "evento, apertura o promoción" : "eventos, aperturas y promociones"} en estas fechas
                </span>
                <span className="text-[13px] font-medium text-brand-700 group-open:hidden">Mostrar</span>
                <span className="hidden text-[13px] text-[var(--ink-soft)] group-open:inline">Ocultar</span>
              </summary>
              <ul className="divide-y divide-[var(--rule)] border-t border-[var(--rule)]">
                {others.map((a) => (
                  <AlertRow key={a.item.id} alert={a} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Card>
  );
}

function AlertRow({ alert: a }: { alert: TripAlert }) {
  const Icon = a.warning ? AlertTriangle : Info;
  return (
    <li>
      <details className="group px-5 py-3">
        <summary className="flex cursor-pointer list-none items-start gap-3">
          <Icon className={clsx("mt-0.5 size-4 shrink-0", a.warning ? "text-amber-700" : "text-sky-700")} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-900">{a.item.title}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--ink-soft)]">
              <span>{KNOWLEDGE_CATEGORY_LABEL[a.item.category]}</span>
              <span>·</span>
              <span className={clsx(a.warning && "font-medium text-amber-900")}>{overlapText(a)}</span>
              {a.item.park && <span>· {a.item.park}</span>}
            </span>
          </span>
          <span className="shrink-0 pt-0.5 text-[13px] font-medium text-brand-700 group-open:hidden">Ver más</span>
          <span className="hidden shrink-0 pt-0.5 text-[13px] text-[var(--ink-soft)] group-open:inline">Ocultar</span>
        </summary>
        <div className="mt-2 ml-7 text-sm whitespace-pre-line text-slate-700">
          {a.item.content}
          {a.item.sourceUrl && (
            <a href={a.item.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block text-[13px] font-medium text-brand-700 hover:underline">
              Fuente
            </a>
          )}
        </div>
      </details>
    </li>
  );
}
