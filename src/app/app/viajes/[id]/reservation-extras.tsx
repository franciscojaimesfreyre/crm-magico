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

/**
 * Importe de la reserva con el tax discriminado opcional (link debajo del importe). Si hay tax, la
 * comisión en porcentaje se calcula sobre el importe sin tax. Envía price y taxAmount.
 */
export function PriceWithTax({ price, tax, currency }: { price?: string; tax?: string; currency: string }) {
  const [showTax, setShowTax] = useState(Boolean(tax));
  const [total, setTotal] = useState(price ?? "");
  const [taxValue, setTaxValue] = useState(tax ?? "");
  const t = Number(total.replace(",", "."));
  const x = Number(taxValue.replace(",", "."));
  const net = showTax && taxValue && Number.isFinite(t) && Number.isFinite(x) ? Math.round((t - x) * 100) / 100 : null;
  const fmt = (v: number) => v.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return (
    <>
      <label className="block">
        <span className="label">Importe</span>
        <input type="number" step="0.01" min={0} name="price" value={total} onChange={(e) => setTotal(e.target.value)} required className="field" />
        {showTax ? (
          net !== null && (
            <span className={net < 0 ? "mt-1 block text-xs text-rose-600" : "mt-1 block text-xs text-slate-500"}>
              {net < 0 ? "El tax no puede superar el importe" : `Sin tax: ${currency} ${fmt(net)}. La comisión en % se calcula sobre este valor.`}
            </span>
          )
        ) : (
          <button type="button" onClick={() => setShowTax(true)} className="mt-1 text-xs font-medium text-brand-700 hover:underline">
            Discriminar tax
          </button>
        )}
      </label>
      {showTax && (
        <label className="block">
          <span className="label">Tax incluido en el importe</span>
          <input type="number" step="0.01" min={0} name="taxAmount" value={taxValue} onChange={(e) => setTaxValue(e.target.value)} className="field" autoFocus={!tax} />
          <button
            type="button"
            onClick={() => {
              setShowTax(false);
              setTaxValue("");
            }}
            className="mt-1 text-xs font-medium text-slate-500 hover:text-rose-600"
          >
            Quitar tax
          </button>
        </label>
      )}
    </>
  );
}

export type TravelerOption = { id: string; firstName: string; lastName: string | null; detail?: string };

/**
 * Viajeros incluidos en la reserva: los del cliente para marcar y, si falta alguno, se agrega acá
 * mismo (queda cargado en el cliente y en el viaje). Envía travelerIds y los new* de cada viajero nuevo.
 */
export function ReservationTravelers({ travelers, selected, required }: { travelers: TravelerOption[]; selected: string[]; required: boolean }) {
  const ref = useRef<HTMLFieldSetElement>(null);
  const [rows, setRows] = useState<number[]>(required && travelers.length === 0 ? [0] : []);
  const nextRow = useRef(1);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onReset = () => setRows([]);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  return (
    <fieldset ref={ref}>
      <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Viajeros incluidos{required && " *"}</legend>
      {travelers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {travelers.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm has-checked:border-brand-300 has-checked:bg-brand-50">
              <input type="checkbox" name="travelerIds" value={t.id} defaultChecked={selected.includes(t.id)} className="size-4 rounded border-slate-300 text-brand-600" />
              <span className="font-medium text-slate-800">
                {t.firstName} {t.lastName}
              </span>
              {t.detail && <span className="text-xs text-slate-500">{t.detail}</span>}
            </label>
          ))}
        </div>
      )}
      {rows.map((row) => (
        <div key={row} className="mt-3 grid gap-2 rounded-lg border border-dashed border-slate-300 p-3 sm:grid-cols-[1fr_1fr_10rem_7rem_1fr_auto]">
          <label className="block">
            <span className="label">Nombre *</span>
            <input name="newFirstName" required className="field" />
          </label>
          <label className="block">
            <span className="label">Apellido</span>
            <input name="newLastName" className="field" />
          </label>
          <label className="block">
            <span className="label">Nacimiento</span>
            <input type="date" name="newBirthDate" className="field" />
          </label>
          <label className="block">
            <span className="label">Altura (cm)</span>
            <input type="number" min={30} max={250} name="newHeightCm" className="field" />
          </label>
          <label className="block">
            <span className="label">Relación</span>
            <input name="newRelationship" placeholder="Titular, hijo/a…" className="field" />
          </label>
          <button type="button" onClick={() => setRows((r) => r.filter((x) => x !== row))} className="self-end pb-2 text-xs text-slate-500 hover:text-rose-600">
            Quitar
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((r) => [...r, nextRow.current++])} className="mt-2 text-xs font-medium text-brand-700 hover:underline">
        + {travelers.length === 0 && rows.length === 0 ? "Agregar viajero" : "¿Falta alguien? Agregar viajero"}
      </button>
      <p className="mt-1 text-xs text-slate-500">Los viajeros nuevos quedan cargados en el cliente y se suman al viaje.</p>
    </fieldset>
  );
}
