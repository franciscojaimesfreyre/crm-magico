"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Plane } from "lucide-react";
import { buttonClass } from "@/components/ui";

export type FlightLegValues = { date: string; time: string; airline: string; flightNumber: string };

/** Campos de un tramo de vuelo (ida o vuelta): fecha, hora, aerolínea y número. */
export function FlightLegInputs({ prefix, title, values }: { prefix: "out" | "back"; title: string; values?: FlightLegValues }) {
  return <LegRow prefix={prefix} title={title} values={values} />;
}

function LegRow({ prefix, title, values }: { prefix: string; title: string; values?: FlightLegValues }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
        <Plane className={prefix === "back" ? "size-4 -scale-x-100 text-sky-600" : "size-4 text-sky-600"} /> {title}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Fecha</span>
          <input type="date" name={`${prefix}Date`} defaultValue={values?.date} className="field" />
        </label>
        <label className="block">
          <span className="label">Hora</span>
          <input type="time" name={`${prefix}Time`} defaultValue={values?.time} className="field" />
        </label>
        <label className="block">
          <span className="label">Aerolínea</span>
          <input name={`${prefix}Airline`} defaultValue={values?.airline} placeholder="Ej: American Airlines" className="field" />
        </label>
        <label className="block">
          <span className="label">N° de vuelo</span>
          <input name={`${prefix}Number`} defaultValue={values?.flightNumber} placeholder="Ej: AA 930" className="field" />
        </label>
      </div>
    </div>
  );
}

const fmt = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Antes de guardar, revisa que las fechas de la reserva estén dentro de las del viaje.
 * Si no, muestra un aviso: puede ser un error de carga, pero también se puede guardar igual.
 */
export function TripDatesGuard({ tripStart, tripEnd }: { tripStart: string | null; tripEnd: string | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const bypass = useRef(false);
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form || (!tripStart && !tripEnd)) return;
    const onSubmit = (e: SubmitEvent) => {
      if (bypass.current) {
        bypass.current = false;
        return;
      }
      const value = (name: string) => form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? "";
      const checks: [string, string][] = [
        ["La reserva empieza", value("startDate")],
        ["La reserva termina", value("endDate")],
      ];
      const found: string[] = [];
      for (const [label, date] of checks) {
        if (!date) continue;
        if (tripStart && date < tripStart) found.push(`${label} el ${fmt(date)}, antes del comienzo del viaje (${fmt(tripStart)}).`);
        else if (tripEnd && date > tripEnd) found.push(`${label} el ${fmt(date)}, después del fin del viaje (${fmt(tripEnd)}).`);
      }
      if (found.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      setIssues(found);
      dialog.current?.showModal();
    };
    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, [tripStart, tripEnd]);

  return (
    <span ref={ref} className="contents">
      <dialog
        ref={dialog}
        className="m-auto w-full max-w-md rounded-2xl p-0 shadow-xl backdrop:bg-slate-900/40"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-slate-900">Las fechas no coinciden con el viaje</h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-slate-600">¿Puede ser un error de carga?</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className={buttonClass("secondary", "md")} onClick={() => dialog.current?.close()}>
              Revisar fechas
            </button>
            <button
              type="button"
              className={buttonClass("primary", "md")}
              onClick={() => {
                dialog.current?.close();
                bypass.current = true;
                ref.current?.closest("form")?.requestSubmit();
              }}
            >
              Guardar igual
            </button>
          </div>
        </div>
      </dialog>
    </span>
  );
}
