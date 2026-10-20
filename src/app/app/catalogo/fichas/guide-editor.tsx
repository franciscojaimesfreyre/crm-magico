"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Eye, Pencil, Save, Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { ParkSheetForm } from "@/components/park-sheet-form";
import { ParkSheetCard } from "@/components/park-sheet";
import { DESTINATIONS } from "@/lib/labels";
import type { ParkSheet, ScheduleEntry } from "@/lib/park-sheet";
import { ScheduleEditor } from "./schedule-editor";
import { deleteParkGuide, saveParkGuide } from "./actions";

/** Alta y edición de una ficha base (solo admins de la plataforma), con vista previa como la ve el viajero. */
export function GuideEditor({
  id,
  initial,
  today,
}: {
  id: string | null;
  initial: { sheet: ParkSheet; destination: string; aliases: string[]; published: boolean; schedule: ScheduleEntry[] };
  /** Hoy en Orlando (YYYY-MM-DD), para los horarios por fecha. */
  today: string;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState(initial.sheet);
  const [destination, setDestination] = useState(initial.destination);
  const [aliases, setAliases] = useState(initial.aliases.join(", "));
  const [published, setPublished] = useState(initial.published);
  const [schedule, setSchedule] = useState(initial.schedule);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const event = sheet.kind === "EVENT";

  function save() {
    start(async () => {
      const res = await saveParkGuide(id, {
        destination: destination as Parameters<typeof saveParkGuide>[1]["destination"],
        aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean),
        published,
        sheet,
        schedule,
      });
      if ("error" in res && res.error) return setMessage({ tone: "error", text: res.error });
      setMessage({ tone: "ok", text: "Ficha guardada." });
      if (!id && "id" in res) router.replace(`/app/catalogo/fichas/${res.id}`);
      else router.refresh();
    });
  }

  function remove() {
    if (!id || !window.confirm("¿Eliminar esta ficha? Los itinerarios que ya la usan no cambian.")) return;
    start(async () => {
      await deleteParkGuide(id);
      router.push("/app/catalogo/fichas");
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-6">
        <label className="block sm:col-span-3">
          <span className="label">{event ? "Nombre del evento *" : "Nombre del parque *"}</span>
          <input className="field" value={sheet.name} onChange={(e) => setSheet({ ...sheet, name: e.target.value })} placeholder={event ? "Ej: Mickey's Not-So-Scary Halloween Party" : "Ej: Magic Kingdom"} />
        </label>
        <label className="block sm:col-span-1">
          <span className="label">Tipo</span>
          <select className="field" value={sheet.kind} onChange={(e) => setSheet({ ...sheet, kind: e.target.value as ParkSheet["kind"] })}>
            <option value="PARK">Parque</option>
            <option value="EVENT">Evento especial</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Destino</span>
          <select className="field" value={destination} onChange={(e) => setDestination(e.target.value)}>
            {DESTINATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {event && (
          <label className="block sm:col-span-2">
            <span className="label">Parque donde se hace *</span>
            <input className="field" value={sheet.park ?? ""} onChange={(e) => setSheet({ ...sheet, park: e.target.value })} placeholder="Ej: Magic Kingdom" />
          </label>
        )}
        <label className={clsx("block", event ? "sm:col-span-4" : "sm:col-span-6")}>
          <span className="label">Otros nombres</span>
          <input className="field" value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder={event ? "Ej: Halloween Party, Fiesta de Halloween, MNSSHP" : "Ej: MK, Magic"} />
          <span className="mt-1 block text-xs text-slate-400">
            Separados por coma. {event ? "Sirven para reconocer el evento en la descripción de una reserva." : "Sirven para reconocer el parque en el título de una actividad."}
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-6">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="rounded border-slate-300" />
          Publicada (la usan los agentes y la IA)
        </label>
      </div>

      <ScheduleEditor kind={sheet.kind} today={today} schedule={schedule} reference={{ openTime: sheet.openTime, closeTime: sheet.closeTime }} onChange={setSchedule} />

      <div className="flex items-center gap-1 border-b border-slate-200">
        {[
          { key: false, label: "Editar", icon: Pencil },
          { key: true, label: "Vista previa", icon: Eye },
        ].map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setPreview(t.key)}
            className={clsx(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
              preview === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700",
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {preview ? (
        <div className="rounded-xl border-l-4 border-l-violet-500 bg-violet-50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-900">{event && sheet.park ? `${sheet.park} · ${sheet.name}` : sheet.name || "Parque"}</p>
          <ParkSheetCard sheet={sheet} />
        </div>
      ) : (
        <ParkSheetForm sheet={sheet} onChange={setSheet} />
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/95 py-3 backdrop-blur">
        <div>
          {id && (
            <button type="button" onClick={remove} disabled={pending} className={buttonClass("ghost", "sm")}>
              <Trash2 className="size-4" /> Eliminar
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {message && <span className={clsx("text-sm", message.tone === "ok" ? "text-emerald-700" : "text-rose-700")}>{message.text}</span>}
          <button type="button" onClick={save} disabled={pending} className={buttonClass("primary")}>
            <Save className="size-4" /> {pending ? "Guardando…" : "Guardar ficha"}
          </button>
        </div>
      </div>
    </div>
  );
}
