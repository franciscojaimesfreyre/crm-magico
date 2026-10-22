import clsx from "clsx";
import { ChevronDown, MapPin } from "lucide-react";
import { ItineraryDaysControls } from "@/components/itinerary-days-controls";
import { ACTIVITY_TYPE_COLOR, ACTIVITY_TYPE_LABEL } from "@/lib/labels";
import { formatDateLong, toDateInput, todayUTC } from "@/lib/format";
import { closedNoteFor, type CheckEntry } from "@/lib/itinerary-checks";
import type { ActivityType } from "@/generated/prisma/enums";
import { parseGuide } from "@/lib/place-guide";
import { PlaceGuideCard } from "@/components/place-guide";
import { parseSheet } from "@/lib/park-sheet";
import { CollapsibleParkSheet } from "@/components/park-sheet";

export type ItineraryDayView = {
  id: string;
  dayNumber: number;
  date: Date | null;
  title: string | null;
  notes: string | null;
  items: {
    id: string;
    type: ActivityType;
    title: string;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    notes: string | null;
    confirmationNumber: string | null;
    /** Ficha del parque o evento (lib/park-sheet) o guía de crucero (lib/place-guide), en JSON. */
    guide?: unknown;
  }[];
};

const DAY_DATE = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Itinerario de solo lectura (CRM, portal del cliente y link público). Cada día se abre y se cierra;
 * arranca abierto solo el de hoy (o el próximo, si el viaje no empezó). Dentro, cada actividad lleva el
 * horario a la izquierda, que es lo primero que se busca, y el color de su tipo.
 */
export function ItineraryView({
  days,
  compact = false,
  closures = [],
  id = "itinerario",
}: {
  days: ItineraryDayView[];
  compact?: boolean;
  /** Atracciones con cierres (catálogo y novedades): en las fichas se ven tachadas el día que están cerradas. */
  closures?: CheckEntry[];
  id?: string;
}) {
  const today = toDateInput(todayUTC());
  const dated = days.filter((d) => d.date);
  const openId = dated.length === 0 ? days[0]?.id : dated.find((d) => toDateInput(d.date!) >= today)?.id;

  return (
    <div id={id}>
      {days.length > 1 && (
        <div className="mb-3 flex justify-end">
          <ItineraryDaysControls containerId={id} />
        </div>
      )}
      <div className="space-y-3">
        {days.map((d) => (
          <details key={d.id} data-day open={d.id === openId} className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 select-none hover:bg-[var(--raised)] sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="shrink-0 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">Día {d.dayNumber}</span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900">
                {d.title || (d.items.length ? `${d.items.length} ${d.items.length === 1 ? "actividad" : "actividades"}` : "Día libre")}
              </span>
              {d.date && <span className="shrink-0 text-sm text-[var(--ink-soft)] first-letter:uppercase">{DAY_DATE.format(d.date).replace(/[.,]/g, "")}</span>}
              <ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--rule)] px-3 pt-4 pb-5 sm:px-5">
              {d.date && <p className="mb-3 text-[13px] font-medium text-[var(--ink-soft)] first-letter:uppercase sm:pl-[4.75rem]">{formatDateLong(d.date)}</p>}
              {d.notes && <p className="mb-4 rounded-xl bg-[var(--raised)] px-4 py-3 text-sm whitespace-pre-line text-slate-700 sm:ml-[4.75rem]">{d.notes}</p>}
              {d.items.length === 0 ? (
                <p className="text-sm text-[var(--ink-soft)] sm:pl-[4.75rem]">Día libre.</p>
              ) : (
                <ol className={clsx("space-y-2.5", compact && "space-y-1.5")}>
                  {d.items.map((i) => (
                    <li key={i.id} className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4rem_minmax(0,1fr)]">
                      <div className="pt-3 text-right">
                        {i.startTime && <p className="figure text-sm leading-none text-slate-900">{i.startTime}</p>}
                        {i.endTime && <p className="mt-1 text-xs text-[var(--ink-soft)] tabular-nums">{i.endTime}</p>}
                      </div>
                      <div className={clsx("min-w-0 rounded-xl border-l-4 px-4 py-3", ACTIVITY_TYPE_COLOR[i.type])}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <p className="text-sm font-semibold text-slate-900">{i.title}</p>
                          <span className="text-xs font-medium text-[var(--ink-soft)]">{ACTIVITY_TYPE_LABEL[i.type]}</span>
                        </div>
                        {(i.location || i.confirmationNumber) && (
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                            {i.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="size-3" />
                                {i.location}
                              </span>
                            )}
                            {i.confirmationNumber && <span>Conf. {i.confirmationNumber}</span>}
                          </div>
                        )}
                        {i.notes && !compact && <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-slate-700">{i.notes}</p>}
                        {!compact && <ItemGuide item={i} closedNote={closedNoteFor(closures, d.date ? toDateInput(d.date) : null)} />}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function ItemGuide({ item, closedNote }: { item: ItineraryDayView["items"][number]; closedNote?: (name: string) => string | null }) {
  const sheet = parseSheet(item.guide);
  if (sheet) {
    return (
      <div className="mt-2.5">
        <CollapsibleParkSheet sheet={sheet} closedNote={closedNote} />
      </div>
    );
  }
  const guide = parseGuide(item.guide);
  if (!guide) return null;
  return (
    <div className="mt-2.5">
      <PlaceGuideCard guide={guide} cruise={item.type === "CRUISE"} />
    </div>
  );
}
