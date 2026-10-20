"use client";

import { CalendarClock, Trash2 } from "lucide-react";
import type { ScheduleEntry } from "@/lib/park-sheet";

const WEEKDAY = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const pretty = (date: string) => WEEKDAY.format(new Date(`${date}T00:00:00Z`));

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Horarios por fecha de una ficha. Parques: hoy y los 4 días siguientes (y otras fechas si se agregan).
 * Eventos: las próximas fechas en que se hace, cada una con su horario.
 */
export function ScheduleEditor({
  kind,
  today,
  schedule,
  reference,
  onChange,
}: {
  kind: "PARK" | "EVENT";
  /** Hoy en Orlando (YYYY-MM-DD). */
  today: string;
  schedule: ScheduleEntry[];
  /** Horario de referencia de la ficha, para completar rápido. */
  reference: { openTime: string | null; closeTime: string | null };
  onChange: (s: ScheduleEntry[]) => void;
}) {
  const park = kind === "PARK";
  const window = park ? Array.from({ length: 5 }, (_, i) => addDays(today, i)) : [];
  const future = schedule.filter((s) => s.date >= today);
  const rows = [
    ...window.map((date) => future.find((s) => s.date === date) ?? { date, openTime: null, closeTime: null, note: "" }),
    ...future.filter((s) => !window.includes(s.date)),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const set = (date: string, patch: Partial<ScheduleEntry>) => {
    const current = rows.find((r) => r.date === date)!;
    const next = { ...current, ...patch };
    onChange([...future.filter((s) => s.date !== date && s.date !== next.date), next].sort((a, b) => a.date.localeCompare(b.date)));
  };
  const remove = (date: string) => onChange(future.filter((s) => s.date !== date));
  const add = () => {
    let date = rows.length ? addDays(rows[rows.length - 1].date, 1) : today;
    while (rows.some((r) => r.date === date)) date = addDays(date, 1);
    onChange([...future, { date, openTime: reference.openTime, closeTime: reference.closeTime, note: "" }]);
  };
  const fillReference = () =>
    onChange(rows.map((r) => (r.openTime || r.closeTime ? r : { ...r, openTime: reference.openTime, closeTime: reference.closeTime })));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <CalendarClock className="size-4 text-brand-600" /> {park ? "Horarios de los próximos días" : "Próximas fechas del evento"}
          </p>
          <p className="text-xs text-slate-500">
            {park
              ? "Hoy y los 4 días siguientes (hora de Orlando). Cuando un parque se suma al itinerario en una de estas fechas, toma este horario en vez del de referencia."
              : "Las fechas en que se hace, con su horario. El día del evento en el itinerario toma el horario de esa fecha."}
          </p>
        </div>
        {(reference.openTime || reference.closeTime) && rows.some((r) => !r.openTime && !r.closeTime) && (
          <button type="button" onClick={fillReference} className="text-xs font-medium text-brand-700 hover:underline">
            Completar vacíos con {reference.openTime ?? "…"} – {reference.closeTime ?? "…"}
          </button>
        )}
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.date} className="grid items-center gap-2 sm:grid-cols-[10rem_8.5rem_8.5rem_minmax(0,1fr)_auto]">
            {window.includes(r.date) ? (
              <span className="text-sm font-medium text-slate-700 first-letter:uppercase">
                {r.date === today ? `Hoy · ${pretty(r.date)}` : pretty(r.date)}
              </span>
            ) : (
              <input type="date" className="field" min={today} value={r.date} onChange={(e) => e.target.value && set(r.date, { date: e.target.value })} />
            )}
            <input type="time" className="field" value={r.openTime ?? ""} onChange={(e) => set(r.date, { openTime: e.target.value || null })} aria-label={park ? "Abre" : "Empieza"} title={park ? "Abre" : "Empieza"} />
            <input type="time" className="field" value={r.closeTime ?? ""} onChange={(e) => set(r.date, { closeTime: e.target.value || null })} aria-label={park ? "Cierra" : "Termina"} title={park ? "Cierra" : "Termina"} />
            <input className="field" value={r.note} onChange={(e) => set(r.date, { note: e.target.value })} placeholder={park ? "Nota (ej: Early Entry 8:30, cierra a las 18 por la fiesta)" : "Nota (ej: ingreso desde las 16:00, agotada)"} />
            <button type="button" onClick={() => remove(r.date)} className="p-1 text-slate-400 hover:text-rose-600" title={window.includes(r.date) ? "Vaciar" : "Quitar fecha"}>
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={add} className="mt-2 text-xs font-medium text-brand-700 hover:underline">
        + {park ? "Agregar otra fecha" : "Agregar fecha"}
      </button>
    </div>
  );
}
