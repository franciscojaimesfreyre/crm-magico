"use client";

import { useState, useTransition, type FormEvent } from "react";
import clsx from "clsx";
import { Check, CheckCircle2, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { Alert, buttonClass } from "@/components/ui";
import type { ActionState } from "@/components/form-controls";
import { SelectField } from "@/components/select-field";
import { AUTOCOMPLETE, TRAVELER_FIELDS, type FormField, type TravelerAnswer } from "@/lib/forms";

/*
 * El formulario que completa el cliente (link público o personal). Pensado para el teléfono: letra de 16 px
 * (el iPhone no hace zoom), campos de 44 px, autocompletado de nombre, email y teléfono, y al enviar se
 * reemplaza por una pantalla de gracias (no queda el formulario vacío para mandarlo dos veces).
 */

const FIELD = "field !min-h-11 !text-base";

export function FormRenderer({
  fields,
  action,
  travelers = [],
  doneText = "Tu agente ya tiene tus respuestas.",
}: {
  fields: FormField[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Viajeros que ya conocemos (pedido personal): el campo "Viajeros" arranca con ellos. */
  travelers?: TravelerAnswer[];
  doneText?: string;
}) {
  // Se envía a mano (no con <form action>): si el servidor devuelve un error, lo escrito queda en pantalla.
  const [state, setState] = useState<ActionState>(undefined);
  const [pending, startTransition] = useTransition();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(undefined, data);
      setState(result);
      if (result?.error) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };
  if (state?.ok) {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-12 text-emerald-600" />
        <p className="text-lg font-semibold text-slate-900">{state.ok}</p>
        <p className="mt-1 text-[15px] text-slate-600">{doneText}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {fields.map((f) =>
        f.type === "travelers" ? (
          <TravelersField key={f.id} field={f} initial={travelers} />
        ) : f.type === "checkbox" ? (
          <label key={f.id} className="flex min-h-11 items-center gap-3 text-base text-slate-800">
            <input type="checkbox" name={f.id} className="size-5 rounded border-slate-300" /> {f.label}
          </label>
        ) : (
          <label key={f.id} className="block">
            <span className="mb-1.5 block text-[15px] font-medium text-slate-800">
              {f.label} {f.required && <span className="text-rose-600">*</span>}
            </span>
            {f.type === "textarea" ? (
              <textarea name={f.id} rows={3} required={f.required} className={FIELD} />
            ) : f.type === "select" ? (
              <SelectField name={f.id} required={f.required} placeholder="Elegí una opción" options={(f.options ?? []).map((o) => ({ value: o, label: o }))} />
            ) : (
              <input
                name={f.id}
                required={f.required}
                type={f.type === "phone" ? "tel" : f.type}
                inputMode={f.type === "number" ? "numeric" : undefined}
                autoComplete={(f.mapTo && AUTOCOMPLETE[f.mapTo]) || undefined}
                className={FIELD}
              />
            )}
          </label>
        ),
      )}
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "min-h-12 w-full text-base")}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Enviando…
          </>
        ) : (
          "Enviar"
        )}
      </button>
    </form>
  );
}

/** Lista de viajeros: una tarjeta por persona, con los que ya conocemos precargados y "Agregar otro". */
function TravelersField({ field, initial }: { field: FormField; initial: TravelerAnswer[] }) {
  const [rows, setRows] = useState<(TravelerAnswer & { key: number })[]>(() =>
    (initial.length ? initial : [{ firstName: "" }]).map((t, i) => ({ ...t, key: i })),
  );
  const [next, setNext] = useState(rows.length);
  // Los viajeros que ya tienen todo arrancan plegados: primero se ve lo que falta.
  const complete = (r: TravelerAnswer) => !!(r.travelerId && r.birthDate && r.passportExpiry);
  const [open, setOpen] = useState<Set<number>>(() => new Set(rows.filter((r) => !complete(r)).map((r) => r.key)));
  const toggle = (key: number) => setOpen((o) => {
    const n = new Set(o);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
  });
  return (
    <fieldset>
      <legend className="mb-1.5 text-[15px] font-medium text-slate-800">
        {field.label} {field.required && <span className="text-rose-600">*</span>}
      </legend>
      <p className="mb-3 text-sm text-slate-600">Una tarjeta por persona que viaja. Del pasaporte solo necesitamos la fecha de vencimiento.</p>
      <input type="hidden" name={`${field.id}__count`} value={rows.length} />
      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={r.key} className="rounded-xl border border-[var(--border)] bg-[var(--raised)] p-4">
            <div className={clsx("flex items-center justify-between gap-2", open.has(r.key) && "mb-3")}>
              <button type="button" onClick={() => toggle(r.key)} className="flex min-h-11 flex-1 items-center gap-2 text-left" aria-expanded={open.has(r.key)}>
                <span className="font-semibold text-slate-900">{r.travelerId ? [r.firstName, r.lastName].filter(Boolean).join(" ") : `Viajero ${i + 1}`}</span>
                {complete(r) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    <Check className="size-3" /> Completo
                  </span>
                )}
                <ChevronDown className={clsx("ml-auto size-4 text-slate-500 transition-transform", open.has(r.key) && "rotate-180")} />
              </button>
              {!r.travelerId && rows.length > 1 && (
                <button type="button" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-white hover:text-rose-600" aria-label="Quitar">
                  <X className="size-4" />
                </button>
              )}
            </div>
            {r.travelerId && <input type="hidden" name={`${field.id}__${i}__travelerId`} value={r.travelerId} />}
            {/* Plegada sigue en el formulario (oculta), así se envía igual. */}
            <div className={clsx("grid grid-cols-1 gap-3 sm:grid-cols-2", !open.has(r.key) && "hidden")}>
              {TRAVELER_FIELDS.map((t) => (
                <label key={t.key} className={t.type === "text" && t.key !== "firstName" && t.key !== "lastName" ? "sm:col-span-2" : undefined}>
                  <span className="mb-1 block text-sm text-slate-700">{t.label}</span>
                  <input
                    name={`${field.id}__${i}__${t.key}`}
                    type={t.type}
                    inputMode={t.type === "number" ? "numeric" : undefined}
                    defaultValue={r[t.key] ?? ""}
                    required={t.key === "firstName"}
                    autoComplete="off"
                    className={FIELD}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          setRows([...rows, { firstName: "", key: next }]);
          setOpen(new Set([...open, next]));
          setNext(next + 1);
        }}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[15px] font-medium text-brand-700 hover:bg-brand-50"
      >
        <Plus className="size-4" /> Agregar otro viajero
      </button>
    </fieldset>
  );
}
