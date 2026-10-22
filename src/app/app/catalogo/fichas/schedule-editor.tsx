"use client";

import { useState } from "react";
import { CalendarClock, RefreshCw, Trash2 } from "lucide-react";
import { LightningLanePrices, ThemeParksCredit } from "@/components/themeparks";
import type { ScheduleEntry } from "@/lib/park-sheet";
import { DateInput } from "@/components/date-input";
import { TimeInput } from "@/components/time-input";

/** Filas que se ven antes de "Ver todas" (los parques sincronizados tienen unos 70 días). */
const VISIBLE_ROWS = 8;

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
  const [showAll, setShowAll] = useState(false);
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
    setShowAll(true);
  };
  const fillReference = () =>
    onChange(rows.map((r) => (r.openTime || r.closeTime ? r : { ...r, openTime: reference.openTime, closeTime: reference.closeTime })));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <CalendarClock className="size-4 text-brand-600" /> {park ? "Horarios de los próximos días" : "Próximas fechas del evento"}
          </p>
          <p className="text-xs text-slate-500">
            {park
              ? "Hoy y los días siguientes (hora del parque). Cuando un parque se suma al itinerario en una de estas fechas, toma este horario en vez del de referencia."
              : "Las fechas en que se hace, con su horario. El día del evento en el itinerario toma el horario de esa fecha."}{" "}
            Los días marcados con <RefreshCw className="inline size-3" /> vienen de ThemeParks.wiki y se actualizan solos.
          </p>
        </div>
        {(reference.openTime || reference.closeTime) && rows.some((r) => !r.openTime && !r.closeTime) && (
          <button type="button" onClick={fillReference} className="text-xs font-medium text-brand-700 hover:underline">
            Completar vacíos con {reference.openTime ?? "…"} – {reference.closeTime ?? "…"}
          </button>
        )}
      </div>
      <ul className="mt-3 space-y-1.5">
        {(showAll ? rows : rows.slice(0, VISIBLE_ROWS)).map((r) => (
          <li key={r.date} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[10rem_8.5rem_8.5rem_minmax(0,1fr)_auto]">
            {window.includes(r.date) || r.synced ? (
              <span className="flex items-center gap-1 text-sm font-medium text-slate-700 first-letter:uppercase">
                {r.date === today ? `Hoy · ${pretty(r.date)}` : pretty(r.date)}
                {r.synced && <RefreshCw className="size-3 text-slate-500" aria-label="De ThemeParks.wiki" />}
              </span>
            ) : (
              <DateInput min={today} value={r.date} onChange={(v) => v && set(r.date, { date: v })} required />
            )}
            <TimeInput value={r.openTime} onChange={(v) => set(r.date, { openTime: v || null })} aria-label={park ? "Abre" : "Empieza"} placeholder={park ? "Abre" : "Empieza"} />
            <TimeInput value={r.closeTime} onChange={(v) => set(r.date, { closeTime: v || null })} aria-label={park ? "Cierra" : "Termina"} placeholder={park ? "Cierra" : "Termina"} />
            <input className="field" value={r.note} onChange={(e) => set(r.date, { note: e.target.value })} placeholder={park ? "Nota (ej: Early Entry 8:30, cierra a las 18 por la fiesta)" : "Nota (ej: ingreso desde las 16:00, agotada)"} />
            <button type="button" onClick={() => remove(r.date)} className="p-1 text-slate-500 hover:text-rose-600" title={window.includes(r.date) ? "Vaciar" : "Quitar fecha"}>
              <Trash2 className="size-4" />
            </button>
            {r.lightningLane && (
              <div className="sm:col-span-5 sm:col-start-1 sm:pl-[10.5rem]">
                <LightningLanePrices entry={r} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {rows.length > VISIBLE_ROWS && (
          <button type="button" onClick={() => setShowAll(!showAll)} className="text-xs font-medium text-brand-700 hover:underline">
            {showAll ? "Ver menos" : `Ver las ${rows.length} fechas`}
          </button>
        )}
        <button type="button" onClick={add} className="text-xs font-medium text-brand-700 hover:underline">
          + {park ? "Agregar otra fecha" : "Agregar fecha"}
        </button>
        {rows.some((r) => r.synced) && <ThemeParksCredit className="ml-auto" />}
      </div>
    </div>
  );
}
