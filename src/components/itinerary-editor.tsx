"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { AlertTriangle, ArrowDownUp, CalendarPlus, Clock, GripVertical, MapPin, Plus, Save, ShieldCheck, Star, Trash2, Wand2, X } from "lucide-react";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_COLOR, ACTIVITY_TYPE_LABEL } from "@/lib/labels";
import { buttonClass } from "@/components/ui";
import type { ActivityType } from "@/generated/prisma/enums";
import { checkItinerary, withMustDos, type CheckEntry, type CheckTraveler, type ItemWarning } from "@/lib/itinerary-checks";
import { proposeItinerary, saveItinerary, type ItineraryDayInput, type ItineraryTarget } from "@/app/app/viajes/itinerary-actions";

// ─── Estado del editor ───────────────────────────────────────────────────────

type ItemState = {
  key: string;
  type: ActivityType;
  title: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  confirmationNumber: string | null;
};

type DayState = { key: string; date: string | null; title: string | null; notes: string | null; items: ItemState[] };

export type EditorTemplate = { id: string; type: ActivityType; title: string; location: string | null; durationMin: number | null; notes: string | null };

const NONE: never[] = [];

let counter = 0;
const newKey = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

function toState(days: ItineraryDayInput[]): DayState[] {
  return days.map((d) => ({ ...d, key: newKey("d"), items: d.items.map((i) => ({ ...i, key: newKey("i") })) }));
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Saca la etiqueta interna "IMPERDIBLE" del catálogo de un texto que ve el cliente. */
function withoutMustDoTag(text: string) {
  return text
    .replace(/\s*[([]?\s*imperdible\s*[)\]]?\s*[.,;:–-]?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Actividad para un imperdible del catálogo que la propuesta no incluyó. */
function mustDoItem(e: CheckEntry): ItemState {
  return {
    key: newKey("i"),
    type: e.kind === "SHOW" ? "SHOW" : "RIDE",
    title: e.name,
    startTime: null,
    endTime: null,
    location: e.area,
    notes: null,
    confirmationNumber: null,
  };
}

function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last && out.length < 60) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function prettyDate(date: string | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

// ─── Editor ──────────────────────────────────────────────────────────────────

const DETAIL_OPTIONS = [
  { value: "detailed", label: "Detallado", hint: "Hora por hora: atracciones, shows, comidas, descansos y traslados." },
  { value: "summary", label: "Resumido", hint: "Solo lo clave: check-in y check-out, el parque de cada día, shows contratados y reservas de restaurantes." },
] as const;

export function ItineraryEditor({
  target,
  initialDays,
  startDate,
  endDate,
  templates,
  aiEnabled,
  catalog = NONE,
  travelers = NONE,
}: {
  target: ItineraryTarget;
  initialDays: ItineraryDayInput[];
  startDate: string | null;
  endDate: string | null;
  templates: EditorTemplate[];
  aiEnabled: boolean;
  /** Atracciones y shows del catálogo del destino, para la revisión automática. */
  catalog?: CheckEntry[];
  travelers?: CheckTraveler[];
}) {
  const [days, setDays] = useState<DayState[]>(() => toState(initialDays));
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [notify, setNotify] = useState(true);
  const [saving, startSave] = useTransition();
  const [aiOpen, setAiOpen] = useState(initialDays.length === 0 && aiEnabled);
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiDetail, setAiDetail] = useState<"detailed" | "summary">("detailed");
  const [aiResult, setAiResult] = useState<{ summary: string; warnings: string[]; knowledge: { id: string; title: string }[]; added: string[] } | null>(null);
  const [generating, startGenerate] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function update(fn: (prev: DayState[]) => DayState[]) {
    setDays(fn);
    setDirty(true);
    setMessage(null);
  }

  const itemIndex = useMemo(() => {
    const map = new Map<string, { day: number; index: number }>();
    days.forEach((d, di) => d.items.forEach((it, ii) => map.set(it.key, { day: di, index: ii })));
    return map;
  }, [days]);

  // Revisión automática contra el catálogo: alturas, cierres, atracciones que no existen e imperdibles.
  const checks = useMemo(() => checkItinerary(days, catalog, travelers), [days, catalog, travelers]);

  function addMustDo(dayIndex: number, entry: CheckEntry) {
    update((prev) => prev.map((d, di) => (di === dayIndex ? { ...d, items: [...d.items, mustDoItem(entry)] } : d)));
  }

  function addAllMustDos() {
    update((prev) => withMustDos(prev, catalog, mustDoItem).days);
  }

  // ── Días

  function generateDays() {
    if (!startDate || !endDate) return;
    const dates = datesBetween(startDate, endDate);
    update((prev) => {
      const byDate = new Map(prev.filter((d) => d.date).map((d) => [d.date!, d]));
      const generated = dates.map(
        (date, i) =>
          byDate.get(date) ?? {
            key: newKey("d"),
            date,
            title: i === 0 ? "Llegada" : i === dates.length - 1 ? "Regreso" : null,
            notes: null,
            items: [],
          },
      );
      const extra = prev.filter((d) => !d.date || !dates.includes(d.date));
      return [...generated, ...extra];
    });
  }

  function addDay() {
    update((prev) => {
      const last = prev[prev.length - 1]?.date;
      let date: string | null = null;
      if (last) {
        const d = new Date(`${last}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        date = d.toISOString().slice(0, 10);
      }
      return [...prev, { key: newKey("d"), date, title: null, notes: null, items: [] }];
    });
  }

  function patchDay(key: string, patch: Partial<DayState>) {
    update((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function removeDay(key: string) {
    const day = days.find((d) => d.key === key);
    if (day && day.items.length > 0 && !window.confirm("¿Eliminar el día con todas sus actividades?")) return;
    update((prev) => prev.filter((d) => d.key !== key));
  }

  function sortDayByTime(key: string) {
    update((prev) =>
      prev.map((d) =>
        d.key === key
          ? { ...d, items: [...d.items].sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99")) }
          : d,
      ),
    );
  }

  // ── Actividades

  function addItem(dayKey: string, item?: Partial<ItemState>) {
    const created: ItemState = {
      key: newKey("i"),
      type: "CUSTOM",
      title: "Nueva actividad",
      startTime: null,
      endTime: null,
      location: null,
      notes: null,
      confirmationNumber: null,
      ...item,
    };
    update((prev) => prev.map((d) => (d.key === dayKey ? { ...d, items: [...d.items, created] } : d)));
    if (!item) setEditing(created.key);
    return created;
  }

  function patchItem(key: string, patch: Partial<ItemState>) {
    update((prev) => prev.map((d) => ({ ...d, items: d.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) })));
  }

  function removeItem(key: string) {
    update((prev) => prev.map((d) => ({ ...d, items: d.items.filter((i) => i.key !== key) })));
  }

  // ── Drag and drop

  function paletteItem(id: string): Partial<ItemState> | null {
    if (id.startsWith("type:")) {
      const type = id.slice(5) as ActivityType;
      return { type, title: ACTIVITY_TYPE_LABEL[type] };
    }
    if (id.startsWith("tpl:")) {
      const t = templates.find((x) => x.id === id.slice(4));
      if (!t) return null;
      return { type: t.type, title: t.title, location: t.location, notes: t.notes };
    }
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    const pal = paletteItem(id);
    if (pal) return setActiveLabel(pal.title ?? "");
    const pos = itemIndex.get(id);
    setActiveLabel(pos ? days[pos.day].items[pos.index].title : null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveLabel(null);
    if (!e.over) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);

    let targetDay: number;
    let targetIndex: number;
    if (overId.startsWith("day:")) {
      targetDay = days.findIndex((d) => d.key === overId.slice(4));
      if (targetDay < 0) return;
      targetIndex = days[targetDay].items.length;
    } else {
      const pos = itemIndex.get(overId);
      if (!pos) return;
      targetDay = pos.day;
      targetIndex = pos.index;
    }

    const pal = paletteItem(activeId);
    if (pal) {
      const item: ItemState = {
        key: newKey("i"),
        type: "CUSTOM",
        title: "",
        startTime: null,
        endTime: null,
        location: null,
        notes: null,
        confirmationNumber: null,
        ...pal,
      };
      update((prev) =>
        prev.map((d, di) => (di === targetDay ? { ...d, items: [...d.items.slice(0, targetIndex), item, ...d.items.slice(targetIndex)] } : d)),
      );
      return;
    }

    const from = itemIndex.get(activeId);
    if (!from) return;
    if (from.day === targetDay) {
      if (from.index === targetIndex) return;
      update((prev) => prev.map((d, di) => (di === targetDay ? { ...d, items: arrayMove(d.items, from.index, targetIndex) } : d)));
    } else {
      update((prev) => {
        const moving = prev[from.day].items[from.index];
        return prev.map((d, di) => {
          if (di === from.day) return { ...d, items: d.items.filter((i) => i.key !== activeId) };
          if (di === targetDay) return { ...d, items: [...d.items.slice(0, targetIndex), moving, ...d.items.slice(targetIndex)] };
          return d;
        });
      });
    }
  }

  // ── Guardar / IA

  function save() {
    const payload: ItineraryDayInput[] = days.map((d) => ({
      date: d.date,
      title: d.title?.trim() || null,
      notes: d.notes?.trim() || null,
      items: d.items.map((i) => ({
        type: i.type,
        title: i.title.trim() || ACTIVITY_TYPE_LABEL[i.type],
        startTime: i.startTime || null,
        endTime: i.endTime || null,
        location: i.location?.trim() || null,
        notes: i.notes?.trim() || null,
        confirmationNumber: i.confirmationNumber?.trim() || null,
      })),
    }));
    startSave(async () => {
      const res = await saveItinerary(target, payload, notify);
      if ("error" in res && res.error) setMessage({ tone: "error", text: res.error });
      else {
        setDirty(false);
        setMessage({ tone: "ok", text: notify ? "Itinerario guardado y avisado al cliente." : "Itinerario guardado." });
      }
    });
  }

  function generate() {
    if (days.some((d) => d.items.length > 0) && !window.confirm("La propuesta de la IA va a reemplazar el itinerario actual en el editor (no se guarda hasta que hagas clic en Guardar). ¿Continuar?")) return;
    startGenerate(async () => {
      setMessage(null);
      const res = await proposeItinerary(target.id, aiInstructions, aiDetail);
      if ("error" in res && res.error) {
        setMessage({ tone: "error", text: res.error });
        return;
      }
      if (!("result" in res) || !res.result) return;
      const r = res.result;
      const state = toState(
          r.days.map((d) => ({
            date: d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
            title: withoutMustDoTag(d.title) || d.title,
            notes: withoutMustDoTag(d.notes ?? "") || null,
            items: d.items.map((i) => ({
              type: i.type,
              // Por si la IA copia la etiqueta interna del catálogo: título y notas los ve el cliente.
              title: withoutMustDoTag(i.title) || i.title,
              startTime: i.startTime && /^\d{2}:\d{2}$/.test(i.startTime) ? i.startTime : null,
              endTime: i.endTime && /^\d{2}:\d{2}$/.test(i.endTime) ? i.endTime : null,
              location: i.location,
              notes: withoutMustDoTag(i.notes ?? "") || null,
              confirmationNumber: null,
            })),
          })),
      );
      // En la versión resumida no se suman atracciones sueltas: los imperdibles quedan en la revisión para agregarlos a mano.
      const proposed = aiDetail === "detailed" ? withMustDos(state, catalog, mustDoItem) : { days: state, added: [] };
      setDays(proposed.days);
      setDirty(true);
      setAiResult({ summary: r.summary, warnings: r.warnings, knowledge: res.knowledgeUsed, added: proposed.added.map((e) => e.name) });
      setAiOpen(false);
    });
  }

  return (
    <DndContext id="itinerary-editor" sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {/* Barra superior */}
      <div className="sticky top-14 z-10 -mx-6 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {startDate && endDate && (
            <button type="button" onClick={generateDays} className={buttonClass("secondary", "sm")}>
              <CalendarPlus className="size-4" /> Días según fechas del viaje
            </button>
          )}
          <button type="button" onClick={addDay} className={buttonClass("secondary", "sm")}>
            <Plus className="size-4" /> Agregar día
          </button>
          {aiEnabled && (
            <button type="button" onClick={() => setAiOpen((v) => !v)} className={buttonClass("magic", "sm")}>
              <Wand2 className="size-4" /> Proponer con IA
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {message && <span className={clsx("text-sm", message.tone === "ok" ? "text-emerald-700" : "text-rose-700")}>{message.text}</span>}
          {dirty && !message && <span className="text-sm text-amber-700">Cambios sin guardar</span>}
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="rounded border-slate-300" />
            Avisar al cliente
          </label>
          <button type="button" onClick={save} disabled={saving} className={buttonClass("primary")}>
            <Save className="size-4" /> {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {aiOpen && (
        <div className="mb-4 rounded-xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-brand-50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-slate-900">Itinerario con IA</p>
              <p className="text-sm text-slate-600">
                Usa las edades de los viajeros, los intereses y el presupuesto del grupo, las reservas, los vuelos, las notas del viaje, el catálogo de parques y las novedades vigentes. No recibe nombres ni datos personales; las alturas las revisa el sistema.
              </p>
            </div>
            <button type="button" onClick={() => setAiOpen(false)} className="text-slate-400 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </div>
          <fieldset className="mt-3">
            <legend className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Nivel de detalle</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {DETAIL_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={clsx(
                    "flex cursor-pointer gap-2.5 rounded-lg border bg-white p-3 text-sm",
                    aiDetail === o.value ? "border-brand-500 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <input type="radio" name="aiDetail" value={o.value} checked={aiDetail === o.value} onChange={() => setAiDetail(o.value)} className="mt-0.5" />
                  <span>
                    <span className="font-medium text-slate-900">{o.label}</span>
                    <span className="block text-xs text-slate-500">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <textarea
            value={aiInstructions}
            onChange={(e) => setAiInstructions(e.target.value)}
            rows={3}
            className="field mt-3"
            placeholder="Instrucciones opcionales. Ej: el día 3 quieren hacer Epic Universe; evitar madrugar; incluir un día de descanso en el hotel."
          />
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={generate} disabled={generating} className={buttonClass("magic")}>
              <Wand2 className="size-4" /> {generating ? "Armando el itinerario… (puede tardar un par de minutos)" : "Generar propuesta"}
            </button>
            <span className="text-xs text-slate-500">La propuesta se carga en el editor para que la revises antes de guardar.</span>
          </div>
        </div>
      )}

      {aiResult && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-white p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-slate-900">Propuesta de la IA</p>
            <button type="button" onClick={() => setAiResult(null)} className="text-slate-400 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-slate-700">{aiResult.summary}</p>
          {aiResult.warnings.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-amber-800">
              {aiResult.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          {aiResult.added.length > 0 && (
            <p className="mt-2 text-xs text-slate-600">
              <Star className="mr-1 inline size-3 text-amber-500" />
              Se sumaron imperdibles que la propuesta no incluía: {aiResult.added.join(" · ")}
            </p>
          )}
          {aiResult.knowledge.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">Novedades usadas: {aiResult.knowledge.map((k) => k.title).join(" · ")}</p>
          )}
        </div>
      )}

      {catalog.length > 0 && days.some((d) => d.items.length > 0) && (
        <div className={clsx("mb-4 rounded-xl border p-4 text-sm", checks.count + checks.missing.length > 0 ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60")}>
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <ShieldCheck className={clsx("size-4", checks.count + checks.missing.length > 0 ? "text-amber-600" : "text-emerald-600")} />
            Revisión automática
            <span className="font-normal text-slate-600">
              {checks.count + checks.missing.length === 0
                ? "· Todo en orden: alturas, cierres e imperdibles."
                : `· ${checks.count} ${checks.count === 1 ? "aviso" : "avisos"} en las actividades${checks.missing.length ? ` · ${checks.missing.length} ${checks.missing.length === 1 ? "imperdible falta" : "imperdibles faltan"}` : ""}`}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Se calcula con el catálogo de parques y la altura de cada viajero, sea una propuesta de la IA o lo que armes a mano.</p>
          {checks.missing.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {checks.missing.map((m) => (
                <button
                  key={m.entry.id}
                  type="button"
                  onClick={() => addMustDo(m.dayIndex, m.entry)}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-amber-500"
                  title={`Agregar al día ${m.dayIndex + 1}`}
                >
                  <Plus className="size-3" /> {m.entry.name} <span className="text-slate-400">· día {m.dayIndex + 1}</span>
                </button>
              ))}
              {checks.missing.length > 1 && (
                <button type="button" onClick={addAllMustDos} className="text-xs font-medium text-brand-700 hover:underline">
                  Agregar todos
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Paleta */}
        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <div>
            <p className="label">Arrastrá a un día</p>
            <div className="flex flex-wrap gap-1.5 lg:flex-col">
              {ACTIVITY_TYPES.map((t) => (
                <PaletteChip key={t.value} id={`type:${t.value}`} label={t.label} type={t.value} />
              ))}
            </div>
          </div>
          {templates.length > 0 && (
            <div>
              <p className="label">Actividades guardadas</p>
              <div className="flex max-h-80 flex-wrap gap-1.5 overflow-y-auto lg:flex-col">
                {templates.map((t) => (
                  <PaletteChip key={t.id} id={`tpl:${t.id}`} label={t.title} type={t.type} />
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Días */}
        <div className="space-y-4">
          {days.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              {startDate && endDate ? "Generá los días según las fechas del viaje o agregalos a mano." : "Agregá el primer día."}
            </div>
          )}
          {days.map((day, di) => (
            <DayColumn
              key={day.key}
              day={day}
              number={di + 1}
              warnings={checks.itemWarnings[di] ?? []}
              editing={editing}
              setEditing={setEditing}
              onPatch={(patch) => patchDay(day.key, patch)}
              onRemove={() => removeDay(day.key)}
              onSort={() => sortDayByTime(day.key)}
              onAddItem={() => addItem(day.key)}
              onPatchItem={patchItem}
              onRemoveItem={removeItem}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeLabel !== null && (
          <div className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm font-medium shadow-lg">{activeLabel || "Actividad"}</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function PaletteChip({ id, label, type }: { id: string; label: string; type: ActivityType }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={clsx(
        "cursor-grab rounded-md border-l-4 px-2.5 py-1.5 text-xs font-medium text-slate-700 select-none active:cursor-grabbing",
        ACTIVITY_TYPE_COLOR[type],
        isDragging && "opacity-40",
      )}
    >
      {label}
    </div>
  );
}

function DayColumn({
  day,
  number,
  warnings,
  editing,
  setEditing,
  onPatch,
  onRemove,
  onSort,
  onAddItem,
  onPatchItem,
  onRemoveItem,
}: {
  day: DayState;
  number: number;
  warnings: ItemWarning[][];
  editing: string | null;
  setEditing: (k: string | null) => void;
  onPatch: (p: Partial<DayState>) => void;
  onRemove: () => void;
  onSort: () => void;
  onAddItem: () => void;
  onPatchItem: (key: string, p: Partial<ItemState>) => void;
  onRemoveItem: (key: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.key}` });
  return (
    <section className={clsx("rounded-xl border bg-white transition-colors", isOver ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200")}>
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="rounded-md bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">Día {number}</span>
        <input
          type="date"
          value={day.date ?? ""}
          onChange={(e) => onPatch({ date: e.target.value || null })}
          className="rounded-md border border-transparent px-1 py-0.5 text-sm text-slate-600 hover:border-slate-200"
        />
        <span className="hidden text-xs text-slate-400 first-letter:uppercase sm:inline-block">{prettyDate(day.date)}</span>
        <input
          value={day.title ?? ""}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="Parque o lugar del día"
          className="min-w-40 flex-1 rounded-md border border-transparent px-2 py-0.5 text-sm font-medium text-slate-900 hover:border-slate-200 focus:border-brand-400 focus:outline-none"
        />
        <button type="button" onClick={onSort} className="text-slate-400 hover:text-slate-700" title="Ordenar por horario">
          <ArrowDownUp className="size-4" />
        </button>
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-rose-600" title="Eliminar día">
          <Trash2 className="size-4" />
        </button>
      </header>
      <div ref={setNodeRef} className="space-y-2 p-3">
        <SortableContext items={day.items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          {day.items.map((item, ii) => (
            <SortableItem
              key={item.key}
              item={item}
              warnings={warnings[ii] ?? []}
              open={editing === item.key}
              onToggle={() => setEditing(editing === item.key ? null : item.key)}
              onPatch={(p) => onPatchItem(item.key, p)}
              onRemove={() => onRemoveItem(item.key)}
            />
          ))}
        </SortableContext>
        {day.items.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">Soltá actividades acá</p>}
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={onAddItem} className="text-xs font-medium text-brand-700 hover:underline">
            + Agregar actividad
          </button>
        </div>
        <textarea
          value={day.notes ?? ""}
          onChange={(e) => onPatch({ notes: e.target.value })}
          placeholder="Notas del día (visibles para el cliente)"
          rows={1}
          className="w-full resize-y rounded-md border border-slate-100 px-2 py-1 text-xs text-slate-600 placeholder:text-slate-300 focus:border-brand-300 focus:outline-none"
        />
      </div>
    </section>
  );
}

function SortableItem({
  item,
  warnings,
  open,
  onToggle,
  onPatch,
  onRemove,
}: {
  item: ItemState;
  warnings: ItemWarning[];
  open: boolean;
  onToggle: () => void;
  onPatch: (p: Partial<ItemState>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx("rounded-lg border-l-4", ACTIVITY_TYPE_COLOR[item.type], isDragging && "opacity-40")}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <button type="button" {...listeners} {...attributes} className="cursor-grab text-slate-400 active:cursor-grabbing" title="Arrastrar">
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-slate-900">{item.title || "Sin título"}</p>
          <p className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{ACTIVITY_TYPE_LABEL[item.type]}</span>
            {item.startTime && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {item.startTime}
                {item.endTime && `–${item.endTime}`}
              </span>
            )}
            {item.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {item.location}
              </span>
            )}
          </p>
          {warnings.map((w, i) => (
            <p key={i} className={clsx("mt-0.5 flex items-start gap-1 text-xs", w.tone === "error" ? "text-rose-700" : "text-amber-700")}>
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              {w.text}
            </p>
          ))}
        </button>
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-rose-600" title="Quitar">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {open && (
        <div className="grid gap-2 border-t border-white/60 bg-white/70 p-3 sm:grid-cols-6">
          <input className="field sm:col-span-3" value={item.title} onChange={(e) => onPatch({ title: e.target.value })} placeholder="Título" autoFocus />
          <select className="field sm:col-span-1" value={item.type} onChange={(e) => onPatch({ type: e.target.value as ActivityType })}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className="field"
            type="time"
            value={item.startTime ?? ""}
            onChange={(e) => {
              const startTime = e.target.value || null;
              onPatch({ startTime, endTime: item.endTime ?? (startTime ? addMinutes(startTime, 60) : null) });
            }}
            title="Desde"
          />
          <input className="field" type="time" value={item.endTime ?? ""} onChange={(e) => onPatch({ endTime: e.target.value || null })} title="Hasta" />
          <input className="field sm:col-span-3" value={item.location ?? ""} onChange={(e) => onPatch({ location: e.target.value })} placeholder="Lugar / parque / área" />
          <input className="field sm:col-span-3" value={item.confirmationNumber ?? ""} onChange={(e) => onPatch({ confirmationNumber: e.target.value })} placeholder="N° de confirmación" />
          <textarea className="field sm:col-span-6" rows={2} value={item.notes ?? ""} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="Notas y tips para el cliente" />
        </div>
      )}
    </div>
  );
}
