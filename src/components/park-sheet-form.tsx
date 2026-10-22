"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { SECTION_DETAIL_HINT, SECTION_KINDS, SECTION_LABEL, TIMED_SECTIONS, type ParkSheet, type SectionKind, type SheetItem, type SheetSection } from "@/lib/park-sheet";
import { useId } from "react";
import { SelectField } from "@/components/select-field";
import { Field, FieldLabel } from "@/components/shadcn/field";
import { Input } from "@/components/shadcn/input";
import { Textarea } from "@/components/shadcn/textarea";
import { TimeInput } from "@/components/time-input";

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

const iconButton = "p-1 text-slate-500 hover:text-slate-700 disabled:opacity-30";

/**
 * Edición completa de una ficha de parque o evento: horarios, llegada, show principal y cada sección
 * con sus ítems. Controlado: cada cambio llama a onChange con la ficha nueva.
 */
export function ParkSheetForm({ sheet, onChange }: { sheet: ParkSheet; onChange: (s: ParkSheet) => void }) {
  const set = (patch: Partial<ParkSheet>) => onChange({ ...sheet, ...patch });
  const setSection = (index: number, patch: Partial<SheetSection>) => set({ sections: sheet.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  const setItem = (si: number, ii: number, patch: Partial<SheetItem>) =>
    setSection(si, { items: sheet.sections[si].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) });
  const addSection = (kind: SectionKind) => set({ sections: [...sheet.sections, { kind, title: SECTION_LABEL[kind], items: [{ name: "", detail: "", time: "" }], note: "" }] });
  const event = sheet.kind === "EVENT";
  const fid = useId();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-6">
        <Field className="sm:col-span-1">
          <FieldLabel htmlFor={`${fid}-open`}>{event ? "Empieza" : "Abre"}</FieldLabel>
          <TimeInput id={`${fid}-open`} value={sheet.openTime} onChange={(v) => set({ openTime: v || null })} />
        </Field>
        <Field className="sm:col-span-1">
          <FieldLabel htmlFor={`${fid}-close`}>{event ? "Termina" : "Cierra"}</FieldLabel>
          <TimeInput id={`${fid}-close`} value={sheet.closeTime} onChange={(v) => set({ closeTime: v || null })} />
        </Field>
        <Field className="col-span-2">
          <FieldLabel htmlFor={`${fid}-arrival`}>Llegada recomendada</FieldLabel>
          <Input id={`${fid}-arrival`} value={sheet.arrival} onChange={(e) => set({ arrival: e.target.value })} placeholder="Ej: 30 min antes de la apertura" />
        </Field>
        <Field className="col-span-2">
          <FieldLabel htmlFor={`${fid}-show`}>Show principal</FieldLabel>
          <Input id={`${fid}-show`} value={sheet.mainShow} onChange={(e) => set({ mainShow: e.target.value })} placeholder="Ej: Happily Ever After · 21:30" />
        </Field>
        <Field className="col-span-2 sm:col-span-6">
          <FieldLabel htmlFor={`${fid}-note`}>Aclaración de horarios</FieldLabel>
          <Input id={`${fid}-note`} value={sheet.hoursNote} onChange={(e) => set({ hoursNote: e.target.value })} placeholder="Ej: Horarios sujetos a cambios: revisar la app el día anterior." />
        </Field>
      </div>

      {sheet.sections.map((s, si) => {
        const timed = TIMED_SECTIONS.includes(s.kind);
        const tips = s.kind === "TIPS";
        return (
          <fieldset key={si} className="rounded-2xl border border-[var(--border)] bg-[var(--raised)] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field className="w-52">
                <FieldLabel htmlFor={`${fid}-${si}-kind`}>Tipo de sección</FieldLabel>
                <SelectField
                  id={`${fid}-${si}-kind`}
                  value={s.kind}
                  onValueChange={(v) => setSection(si, { kind: v as SectionKind })}
                  options={SECTION_KINDS.map((k) => ({ value: k, label: SECTION_LABEL[k] }))}
                />
              </Field>
              <Field className="min-w-40 flex-1">
                <FieldLabel htmlFor={`${fid}-${si}-title`}>Título</FieldLabel>
                <Input id={`${fid}-${si}-title`} className="font-semibold" value={s.title} onChange={(e) => setSection(si, { title: e.target.value })} placeholder="Título de la sección" />
              </Field>
              <span className="flex items-center pb-2">
                <button type="button" className={iconButton} disabled={si === 0} onClick={() => set({ sections: move(sheet.sections, si, si - 1) })} title="Subir sección">
                  <ChevronUp className="size-4" />
                </button>
                <button type="button" className={iconButton} disabled={si === sheet.sections.length - 1} onClick={() => set({ sections: move(sheet.sections, si, si + 1) })} title="Bajar sección">
                  <ChevronDown className="size-4" />
                </button>
                <button type="button" className="p-1 text-slate-500 hover:text-rose-600" onClick={() => set({ sections: sheet.sections.filter((_, j) => j !== si) })} title="Quitar sección">
                  <Trash2 className="size-4" />
                </button>
              </span>
            </div>
            {/* Los nombres de las columnas, una sola vez arriba de la lista. */}
            {s.items.length > 0 && (
              <div
                aria-hidden
                className={
                  tips
                    ? "mt-4 mb-1.5 text-[13px] font-medium text-slate-800"
                    : "mt-4 mb-1.5 hidden gap-1.5 text-[13px] font-medium text-slate-800 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_7rem_auto]"
                }
              >
                {tips ? (
                  "Tips"
                ) : (
                  <>
                    <span>Nombre</span>
                    <span>Detalle</span>
                    {timed && <span className="hidden lg:block">Horario</span>}
                    <span className="w-[5.25rem]" />
                  </>
                )}
              </div>
            )}
            <ul className="space-y-1.5">
              {s.items.map((it, ii) => (
                <li key={ii} className={tips ? "flex gap-1.5" : "grid gap-1.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_7rem_auto]"}>
                  {tips ? (
                    <Textarea className="min-h-10 flex-1" rows={1} aria-label="Tip" value={it.name} onChange={(e) => setItem(si, ii, { name: e.target.value })} placeholder="Un consejo práctico" />
                  ) : (
                    <>
                      <Input aria-label="Nombre" value={it.name} onChange={(e) => setItem(si, ii, { name: e.target.value })} placeholder="Nombre" />
                      <Input aria-label="Detalle" value={it.detail} onChange={(e) => setItem(si, ii, { detail: e.target.value })} placeholder={SECTION_DETAIL_HINT[s.kind]} />
                      {(timed || it.time) && (
                        <Input aria-label="Horario" value={it.time} onChange={(e) => setItem(si, ii, { time: e.target.value })} placeholder="Ej: 11:05 y 15:00" />
                      )}
                    </>
                  )}
                  <span className={tips ? "flex items-start" : "flex items-center justify-end sm:col-start-auto"}>
                    <button type="button" className={iconButton} disabled={ii === 0} onClick={() => setSection(si, { items: move(s.items, ii, ii - 1) })} title="Subir">
                      <ChevronUp className="size-4" />
                    </button>
                    <button type="button" className={iconButton} disabled={ii === s.items.length - 1} onClick={() => setSection(si, { items: move(s.items, ii, ii + 1) })} title="Bajar">
                      <ChevronDown className="size-4" />
                    </button>
                    <button type="button" className="p-1 text-slate-500 hover:text-rose-600" onClick={() => setSection(si, { items: s.items.filter((_, j) => j !== ii) })} title="Quitar">
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-50"
              onClick={() => setSection(si, { items: [...s.items, { name: "", detail: "", time: "" }] })}
            >
              <Plus className="size-4" /> {tips ? "Agregar tip" : "Agregar ítem"}
            </button>
            {!tips && (
              <Field className="mt-3">
                <FieldLabel htmlFor={`${fid}-${si}-tip`}>Tip de la sección</FieldLabel>
                <Input id={`${fid}-${si}-tip`} value={s.note} onChange={(e) => setSection(si, { note: e.target.value })} placeholder="Opcional. Ej: llegar 30 min antes del show" />
              </Field>
            )}
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Agregar sección:</span>
        {SECTION_KINDS.filter((k) => k !== "OTHER").map((k) => (
          <button key={k} type="button" onClick={() => addSection(k)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 hover:border-brand-400">
            <Plus className="size-3" /> {SECTION_LABEL[k]}
          </button>
        ))}
        <button type="button" onClick={() => addSection("OTHER")} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 hover:border-brand-400">
          <Plus className="size-3" /> Otra
        </button>
      </div>
    </div>
  );
}
