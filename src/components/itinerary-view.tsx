import clsx from "clsx";
import { Clock, MapPin } from "lucide-react";
import { ACTIVITY_TYPE_COLOR, ACTIVITY_TYPE_LABEL } from "@/lib/labels";
import { formatDateLong } from "@/lib/format";
import type { ActivityType } from "@/generated/prisma/enums";

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
  }[];
};

/** Itinerario de solo lectura (CRM, portal del cliente y link público). */
export function ItineraryView({ days, compact = false }: { days: ItineraryDayView[]; compact?: boolean }) {
  return (
    <div className="space-y-4">
      {days.map((d) => (
        <section key={d.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="flex flex-wrap items-baseline justify-between gap-2 bg-gradient-to-r from-brand-600 to-fuchsia-600 px-4 py-2.5 text-white">
            <h3 className="font-semibold">
              Día {d.dayNumber}
              {d.title && ` · ${d.title}`}
            </h3>
            {d.date && <span className="inline-block text-sm text-white/80 first-letter:uppercase">{formatDateLong(d.date)}</span>}
          </header>
          {d.notes && <p className="border-b border-slate-100 px-4 py-2 text-sm whitespace-pre-line text-slate-600">{d.notes}</p>}
          {d.items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">Día libre.</p>
          ) : (
            <ul className={clsx("space-y-2 p-3", compact && "space-y-1.5")}>
              {d.items.map((i) => (
                <li key={i.id} className={clsx("rounded-lg border-l-4 px-3 py-2", ACTIVITY_TYPE_COLOR[i.type])}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{i.title}</p>
                    <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{ACTIVITY_TYPE_LABEL[i.type]}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-500">
                    {i.startTime && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {i.startTime}
                        {i.endTime && ` – ${i.endTime}`}
                      </span>
                    )}
                    {i.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {i.location}
                      </span>
                    )}
                    {i.confirmationNumber && <span>Conf. {i.confirmationNumber}</span>}
                  </div>
                  {i.notes && !compact && <p className="mt-1 text-xs whitespace-pre-line text-slate-600">{i.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
