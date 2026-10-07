"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Plane } from "lucide-react";
import { buttonClass } from "@/components/ui";

export type FlightLegValues = { date: string; time: string; airline: string; flightNumber: string };

/** Lee el tipo elegido en el formulario que contiene al elemento y avisa cuando cambia. */
function useFormType(ref: React.RefObject<HTMLElement | null>) {
  const [type, setType] = useState<string | null>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    const select = form?.querySelector<HTMLSelectElement>('select[name="type"]');
    if (!select) return;
    const update = () => setType(select.value);
    const onReset = () => setTimeout(update);
    update();
    select.addEventListener("change", update);
    form?.addEventListener("reset", onReset);
    return () => {
      select.removeEventListener("change", update);
      form?.removeEventListener("reset", onReset);
    };
  }, [ref]);
  return type;
}

/** Tramos de ida y vuelta: solo se muestran en reservas de vuelo. */
export function FlightFields({ outbound, back }: { outbound?: FlightLegValues; back?: FlightLegValues }) {
  const ref = useRef<HTMLDivElement>(null);
  const type = useFormType(ref);
  const visible = type === "FLIGHT";
  return (
    <div ref={ref} className={visible ? "space-y-3 rounded-lg border border-sky-100 bg-sky-50/50 p-3 sm:col-span-4" : "hidden"}>
      <LegRow prefix="out" title="Vuelo de ida" values={outbound} disabled={!visible} />
      <LegRow prefix="back" title="Vuelo de vuelta" values={back} disabled={!visible} />
      <p className="text-xs text-slate-500">Si no completás “Desde” y “Hasta”, se toman de las fechas de ida y vuelta.</p>
    </div>
  );
}

function LegRow({ prefix, title, values, disabled }: { prefix: string; title: string; values?: FlightLegValues; disabled: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[9rem_1fr_7rem_1fr_9rem] sm:items-end">
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700 sm:pb-2">
        <Plane className={prefix === "back" ? "size-4 rotate-180 text-sky-600" : "size-4 text-sky-600"} /> {title}
      </p>
      <label className="block">
        <span className="label">Fecha</span>
        <input type="date" name={`${prefix}Date`} defaultValue={values?.date} disabled={disabled} className="field" />
      </label>
      <label className="block">
        <span className="label">Hora</span>
        <input type="time" name={`${prefix}Time`} defaultValue={values?.time} disabled={disabled} className="field" />
      </label>
      <label className="block">
        <span className="label">Aerolínea</span>
        <input name={`${prefix}Airline`} defaultValue={values?.airline} disabled={disabled} placeholder="Ej: American Airlines" className="field" />
      </label>
      <label className="block">
        <span className="label">N° de vuelo</span>
        <input name={`${prefix}Number`} defaultValue={values?.flightNumber} disabled={disabled} placeholder="Ej: AA 1234" className="field" />
      </label>
    </div>
  );
}

const fmt = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Antes de guardar, revisa que las fechas de la reserva (y de los vuelos) estén dentro de las del viaje.
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
      const value = (name: string) => {
        const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
        return input && !input.disabled ? input.value : "";
      };
      const checks: [string, string][] = [
        ["La reserva empieza", value("startDate")],
        ["La reserva termina", value("endDate")],
        ["El vuelo de ida sale", value("outDate")],
        ["El vuelo de vuelta sale", value("backDate")],
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
    <span ref={ref}>
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
