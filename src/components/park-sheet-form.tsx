"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { SECTION_DETAIL_HINT, SECTION_KINDS, SECTION_LABEL, TIMED_SECTIONS, type ParkSheet, type SectionKind, type SheetItem, type SheetSection } from "@/lib/park-sheet";

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

const iconButton = "p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30";

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

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-6">
        <label className="block sm:col-span-1">
          <span className="label">{event ? "Empieza" : "Abre"}</span>
          <input type="time" className="field" value={sheet.openTime ?? ""} onChange={(e) => set({ openTime: e.target.value || null })} />
        </label>
        <label className="block sm:col-span-1">
          <span className="label">{event ? "Termina" : "Cierra"}</span>
          <input type="time" className="field" value={sheet.closeTime ?? ""} onChange={(e) => set({ closeTime: e.target.value || null })} />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Llegada recomendada</span>
          <input className="field" value={sheet.arrival} onChange={(e) => set({ arrival: e.target.value })} placeholder="Ej: 30 min antes de la apertura" />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Show principal</span>
          <input className="field" value={sheet.mainShow} onChange={(e) => set({ mainShow: e.target.value })} placeholder="Ej: Happily Ever After · 21:30" />
        </label>
        <label className="block sm:col-span-6">
          <span className="label">Aclaración de horarios</span>
          <input className="field" value={sheet.hoursNote} onChange={(e) => set({ hoursNote: e.target.value })} placeholder="Ej: Horarios sujetos a cambios: revisar la app el día anterior." />
        </label>
      </div>

      {sheet.sections.map((s, si) => {
        const timed = TIMED_SECTIONS.includes(s.kind);
        const tips = s.kind === "TIPS";
        return (
          <fieldset key={si} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <select className="field w-auto" value={s.kind} onChange={(e) => setSection(si, { kind: e.target.value as SectionKind })} aria-label="Tipo de sección">
                {SECTION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {SECTION_LABEL[k]}
                  </option>
                ))}
              </select>
              <input className="field min-w-40 flex-1 font-medium" value={s.title} onChange={(e) => setSection(si, { title: e.target.value })} placeholder="Título de la sección" />
              <span className="flex items-center">
                <button type="button" className={iconButton} disabled={si === 0} onClick={() => set({ sections: move(sheet.sections, si, si - 1) })} title="Subir sección">
                  <ChevronUp className="size-4" />
                </button>
                <button type="button" className={iconButton} disabled={si === sheet.sections.length - 1} onClick={() => set({ sections: move(sheet.sections, si, si + 1) })} title="Bajar sección">
                  <ChevronDown className="size-4" />
                </button>
                <button type="button" className="p-1 text-slate-400 hover:text-rose-600" onClick={() => set({ sections: sheet.sections.filter((_, j) => j !== si) })} title="Quitar sección">
                  <Trash2 className="size-4" />
                </button>
              </span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {s.items.map((it, ii) => (
                <li key={ii} className={tips ? "flex gap-1.5" : "grid gap-1.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_7rem_auto]"}>
                  {tips ? (
                    <textarea className="field flex-1" rows={1} value={it.name} onChange={(e) => setItem(si, ii, { name: e.target.value })} placeholder="Un consejo práctico" />
                  ) : (
                    <>
                      <input className="field" value={it.name} onChange={(e) => setItem(si, ii, { name: e.target.value })} placeholder="Nombre" />
                      <input className="field" value={it.detail} onChange={(e) => setItem(si, ii, { detail: e.target.value })} placeholder={SECTION_DETAIL_HINT[s.kind]} />
                      {(timed || it.time) && (
                        <input className="field" value={it.time} onChange={(e) => setItem(si, ii, { time: e.target.value })} placeholder="Horario" />
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
                    <button type="button" className="p-1 text-slate-400 hover:text-rose-600" onClick={() => setSection(si, { items: s.items.filter((_, j) => j !== ii) })} title="Quitar">
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setSection(si, { items: [...s.items, { name: "", detail: "", time: "" }] })}>
                + {tips ? "Agregar tip" : "Agregar ítem"}
              </button>
              {!tips && (
                <input className="field flex-1 text-xs" value={s.note} onChange={(e) => setSection(si, { note: e.target.value })} placeholder="Tip de la sección (opcional). Ej: llegar 30 min antes del show" />
              )}
            </div>
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
