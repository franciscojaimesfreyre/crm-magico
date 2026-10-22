"use client";

import { useState } from "react";
import { Moon } from "lucide-react";
import { DateInput } from "@/components/date-input";

/** Noches entre dos fechas "YYYY-MM-DD" (null si falta alguna o el fin es anterior). */
function nightsBetween(start: string, end: string) {
  if (!start || !end) return null;
  const nights = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
  return Number.isFinite(nights) && nights >= 0 ? nights : null;
}

/** Campos Desde / Hasta que muestran en vivo cuántas noches son. Envían startDate y endDate. */
export function DateRangeFields({ start, end }: { start?: string; end?: string }) {
  const [from, setFrom] = useState(start ?? "");
  const [to, setTo] = useState(end ?? "");
  const nights = nightsBetween(from, to);
  const backwards = Boolean(from && to && to < from);
  return (
    <>
      <label className="block">
        <span className="label">Desde</span>
        <DateInput name="startDate" value={from} onChange={setFrom} />
      </label>
      <label className="block">
        <span className="label">Hasta</span>
        <DateInput name="endDate" value={to} min={from || undefined} onChange={setTo} />
        {nights !== null && (
          <span className="mt-1 flex items-center gap-1 text-xs font-medium text-brand-700">
            <Moon className="size-3.5" /> {nights === 0 ? "Mismo día (sin noches)" : `${nights} ${nights === 1 ? "noche" : "noches"}`}
          </span>
        )}
        {backwards && <span className="mt-1 block text-xs text-rose-700">La fecha de fin es anterior a la de inicio</span>}
      </label>
    </>
  );
}
