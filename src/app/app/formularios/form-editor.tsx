"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { FIELD_TYPES, type FormField } from "@/lib/forms";
import { saveForm } from "./actions";

const MAP_OPTIONS: { value: NonNullable<FormField["mapTo"]> | ""; label: string }[] = [
  { value: "", label: "No guardar en la ficha" },
  { value: "firstName", label: "Nombre" },
  { value: "lastName", label: "Apellido" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Teléfono" },
  { value: "city", label: "Ciudad" },
  { value: "dietaryNotes", label: "Alimentación" },
  { value: "accessibilityNotes", label: "Accesibilidad" },
  { value: "preferenceNotes", label: "Preferencias" },
];

export function FormEditor({
  id,
  initial,
}: {
  id: string;
  initial: { title: string; description: string; active: boolean; fields: FormField[] };
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [active, setActive] = useState(initial.active);
  const [fields, setFields] = useState<FormField[]>(initial.fields);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const patch = (i: number, p: Partial<FormField>) => setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  const move = (i: number, dir: -1 | 1) =>
    setFields((fs) => {
      const j = i + dir;
      if (j < 0 || j >= fs.length) return fs;
      const copy = [...fs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <input className="field text-base font-semibold" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
          <textarea className="field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300" /> Recibiendo respuestas
          </label>
        </div>
        {fields.map((f, i) => (
          <div key={f.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex gap-2">
              <input className="field" value={f.label} onChange={(e) => patch(i, { label: e.target.value })} placeholder="Pregunta" />
              <select className="field w-44" value={f.type} onChange={(e) => patch(i, { type: e.target.value as FormField["type"] })}>
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {f.type === "select" && (
              <input
                className="field"
                value={(f.options ?? []).join(", ")}
                onChange={(e) => patch(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                placeholder="Opciones separadas por coma"
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} className="rounded border-slate-300" /> Obligatorio
                </label>
                <select className="rounded-md border border-slate-200 px-2 py-1 text-xs" value={f.mapTo ?? ""} onChange={(e) => patch(i, { mapTo: (e.target.value || undefined) as FormField["mapTo"] })}>
                  {MAP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-1 text-slate-400">
                <button type="button" onClick={() => move(i, -1)} className="hover:text-slate-700" title="Subir">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} className="hover:text-slate-700" title="Bajar">
                  <ArrowDown className="size-4" />
                </button>
                <button type="button" onClick={() => setFields((fs) => fs.filter((_, idx) => idx !== i))} className="hover:text-rose-600" title="Quitar">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button
            type="button"
            className={buttonClass("secondary", "sm")}
            onClick={() => setFields((fs) => [...fs, { id: `f${Date.now().toString(36)}`, label: "", type: "text", required: false }])}
          >
            <Plus className="size-4" /> Agregar pregunta
          </button>
          <div className="flex items-center gap-3">
            {msg && <span className={msg.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{msg.text}</span>}
            <button
              type="button"
              disabled={pending}
              className={buttonClass("primary")}
              onClick={() =>
                start(async () => {
                  const r = await saveForm(id, { title, description, active, fields });
                  setMsg("error" in r && r.error ? { ok: false, text: r.error } : { ok: true, text: "Guardado" });
                })
              }
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <p className="label">Vista previa</p>
        <div className="space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">{title || "Sin título"}</h3>
          {description && <p className="text-sm text-slate-500">{description}</p>}
          {fields.map((f) => (
            <div key={f.id}>
              {f.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled /> {f.label}
                </label>
              ) : (
                <>
                  <span className="label">
                    {f.label || "Pregunta"} {f.required && "*"}
                  </span>
                  {f.type === "textarea" ? (
                    <textarea className="field" rows={2} disabled />
                  ) : f.type === "select" ? (
                    <select className="field" disabled>
                      <option>{f.options?.[0] ?? "—"}</option>
                    </select>
                  ) : (
                    <input className="field" disabled type={f.type === "phone" ? "tel" : f.type} />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
