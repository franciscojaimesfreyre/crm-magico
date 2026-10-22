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
import { AlertTriangle, ArrowDownUp, BookmarkPlus, CalendarPlus, ChevronDown, ChevronUp, Clock, FerrisWheel, GripVertical, MapPin, PartyPopper, Pencil, Plus, RefreshCw, RotateCcw, Save, ShieldCheck, Sparkles, Star, Trash2, Wand2, X } from "lucide-react";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_COLOR, ACTIVITY_TYPE_LABEL } from "@/lib/labels";
import { buttonClass } from "@/components/ui";
import type { ActivityType } from "@/generated/prisma/enums";
import { checkItinerary, closedNoteFor, matchEntry, minHeightCm, withMustDos, type CheckEntry, type CheckTraveler, type ItemWarning } from "@/lib/itinerary-checks";
import { proposeItinerary, proposePlaceGuide, saveItinerary, type ItineraryDayInput, type ItineraryTarget } from "@/app/app/viajes/itinerary-actions";
import { saveActivityFromItinerary } from "@/app/app/plantillas/actions";
import { GUIDE_PICK_KINDS, GUIDE_PICK_LABEL, hasGuide, type GuidePick, type GuidePickKind, type PlaceGuide } from "@/lib/place-guide";
import { PlaceGuideCard } from "@/components/place-guide";
import { ParkSheetCard } from "@/components/park-sheet";
import { ParkSheetForm } from "@/components/park-sheet-form";
import { emptySheet, eventDateWarning, eventTitle, sheetForPark, sheetFromGuide, sheetNames, type GuideOption, type ParkSheet, type TripEvent } from "@/lib/park-sheet";
import { DateInput } from "@/components/date-input";
import { SelectField } from "@/components/select-field";

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
  /** Días de crucero: recomendaciones y tips de la IA (lo ve el viajero). En parques, solo en itinerarios viejos. */
  guide: PlaceGuide | null;
  /** Parques: la ficha del parque o del evento especial de ese día, copiada del catálogo y editable. */
  sheet: ParkSheet | null;
};

/** Solo los días de crucero llevan guía de la IA; los parques usan la ficha del catálogo. */
const aiGuide = (type: ActivityType) => type === "CRUISE";

/** Estado de la guía de cada actividad mientras la arma la IA. */
type GuideStatus = { loading?: boolean; error?: string };

type DayState = { key: string; date: string | null; title: string | null; notes: string | null; items: ItemState[] };

export type EditorTemplate = { id: string; type: ActivityType; title: string; location: string | null; durationMin: number | null; notes: string | null };

const NONE: never[] = [];

let counter = 0;
const newKey = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

function toState(days: ItineraryDayInput[]): DayState[] {
  return days.map((d) => ({ ...d, key: newKey("d"), items: d.items.map((i) => ({ ...i, guide: i.guide ?? null, sheet: i.sheet ?? null, key: newKey("i") })) }));
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
    guide: null,
    sheet: null,
  };
}

/** La guía como se guarda: sin recomendaciones ni tips vacíos (null si no queda nada). */
function cleanGuide(guide: PlaceGuide | null): PlaceGuide | null {
  if (!guide) return null;
  const picks = guide.picks.map((p) => ({ ...p, name: p.name.trim(), why: p.why.trim() })).filter((p) => p.name);
  const tips = guide.tips.map((t) => t.trim()).filter(Boolean);
  return picks.length + tips.length > 0 ? { picks, tips } : null;
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
  templates: initialTemplates,
  aiEnabled,
  catalog = NONE,
  travelers = NONE,
  parkGuides = NONE,
  events = NONE,
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
  /** Fichas de parques y eventos del catálogo: se copian al sumar un parque. */
  parkGuides?: GuideOption[];
  /** Eventos especiales reservados (fiestas…): ese día el parque lleva la ficha del evento. */
  events?: TripEvent[];
}) {
  const [days, setDays] = useState<DayState[]>(() => toState(initialDays));
  const [templates, setTemplates] = useState(initialTemplates);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [notify, setNotify] = useState(true);
  const [saving, startSave] = useTransition();
  const [aiOpen, setAiOpen] = useState(initialDays.length === 0 && aiEnabled);
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiDetail, setAiDetail] = useState<"detailed" | "summary">("summary");
  const [aiResult, setAiResult] = useState<{ summary: string; warnings: string[]; knowledge: { id: string; title: string }[]; added: string[] } | null>(null);
  const [generating, startGenerate] = useTransition();
  const [guideStatus, setGuideStatus] = useState<Record<string, GuideStatus>>({});
  const [aiGuides, setAiGuides] = useState(true);

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

  /**
   * Un parque sin ficha toma la del catálogo según su título; si ese día hay un evento reservado en
   * ese parque, la del evento (con su horario). Lo demás queda como está.
   */
  function withSheet(item: ItemState, date: string | null): ItemState {
    if (item.type !== "PARK" || item.sheet) return item;
    const found = sheetForPark(item.title, date, parkGuides, events);
    if (!found) return item;
    const sheet = sheetFromGuide(found.guide, date);
    const timed = !item.startTime && !item.endTime;
    return {
      ...item,
      sheet,
      title: found.title ?? item.title,
      startTime: timed ? sheet.openTime : item.startTime,
      endTime: timed ? sheet.closeTime : item.endTime,
    };
  }

  /** Actividad nueva para un evento reservado (o la ficha del evento en el parque que ya estaba ese día). */
  function placeEvent(day: DayState, guide: GuideOption): DayState {
    const sheet = sheetFromGuide(guide, day.date);
    const event = { title: eventTitle(guide), sheet, startTime: sheet.openTime, endTime: sheet.closeTime };
    const park = guide.park ? day.items.findIndex((i) => i.type === "PARK" && (i.sheet?.name === guide.park || sheetForPark(i.title, null, parkGuides, [])?.guide.name === guide.park)) : -1;
    // El día sin título toma el del evento.
    const title = day.title?.trim() ? day.title : event.title;
    if (park >= 0) return { ...day, title, items: day.items.map((i, idx) => (idx === park ? { ...i, ...event } : i)) };
    const item: ItemState = { key: newKey("i"), type: "PARK", location: guide.park, notes: null, confirmationNumber: null, guide: null, ...event };
    return { ...day, title, items: [...day.items, item] };
  }

  /** Eventos reservados de cada día que todavía no figuran en el itinerario. */
  function pendingEvents(day: DayState) {
    if (!day.date) return [];
    return events
      .filter((e) => e.date === day.date)
      .map((e) => parkGuides.find((g) => g.id === e.guideId))
      .filter((g): g is GuideOption => !!g && !day.items.some((i) => i.sheet?.guideId === g.id));
  }

  /** Fichas para los parques sin ficha y los eventos reservados que falten (después de la IA o al generar los días). */
  function withSheetsAndEvents(list: DayState[]) {
    return list.map((d) => pendingEvents(d).reduce(placeEvent, { ...d, items: d.items.map((i) => withSheet(i, d.date)) }));
  }

  const itemIndex = useMemo(() => {
    const map = new Map<string, { day: number; index: number }>();
    days.forEach((d, di) => d.items.forEach((it, ii) => map.set(it.key, { day: di, index: ii })));
    return map;
  }, [days]);

  // Revisión automática contra el catálogo: alturas, cierres, atracciones que no existen e imperdibles.
  const checks = useMemo(
    () =>
      checkItinerary(
        // Lo que recomienda la ficha de cada parque cuenta como incluido (imperdibles).
        days.map((d) => ({ ...d, items: d.items.map((i) => (i.sheet ? { ...i, guide: { picks: sheetNames(i.sheet).map((name) => ({ name })) } } : i)) })),
        catalog,
        travelers,
      ),
    [days, catalog, travelers],
  );

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
      return withSheetsAndEvents([...generated, ...extra]);
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
    update((prev) => prev.map((d) => (d.key === key ? retimeDay({ ...d, ...patch }, d.date) : d)));
  }

  /**
   * Si cambia la fecha del día, los parques y eventos con ficha del catálogo toman el horario cargado
   * para la fecha nueva (o el de referencia). La hora de la actividad se ajusta solo si no la cambiaron a mano.
   */
  function retimeDay(day: DayState, previous: string | null): DayState {
    if (day.date === previous) return day;
    return {
      ...day,
      items: day.items.map((i) => {
        const g = i.sheet?.guideId ? parkGuides.find((x) => x.id === i.sheet!.guideId) : undefined;
        if (!i.sheet || !g) return i;
        const fresh = sheetFromGuide(g, day.date);
        const sheet = { ...i.sheet, openTime: fresh.openTime, closeTime: fresh.closeTime, hoursNote: fresh.hoursNote };
        const untouched = i.startTime === i.sheet.openTime && i.endTime === i.sheet.closeTime;
        return { ...i, sheet, ...(untouched ? { startTime: fresh.openTime, endTime: fresh.closeTime } : {}) };
      }),
    };
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
      guide: null,
      sheet: null,
      ...item,
    };
    update((prev) => prev.map((d) => (d.key === dayKey ? { ...d, items: [...d.items, created] } : d)));
    if (!item) setEditing(created.key);
    return created;
  }

  function patchItem(key: string, patch: Partial<ItemState>) {
    // Al nombrar un parque (o pasar una actividad a parque) se trae su ficha del catálogo.
    const lookup = ("title" in patch || "type" in patch) && !("sheet" in patch);
    update((prev) =>
      prev.map((d) => ({ ...d, items: d.items.map((i) => (i.key === key ? (lookup ? withSheet({ ...i, ...patch }, d.date) : { ...i, ...patch }) : i)) })),
    );
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
    if (id.startsWith("guide:")) {
      const g = parkGuides.find((x) => x.id === id.slice(6));
      if (!g) return null;
      // La ficha (con el horario de ese día) se arma al soltarla en el día: ver onDragEnd.
      return { type: "PARK", title: g.kind === "EVENT" ? eventTitle(g) : g.name, location: g.kind === "EVENT" ? g.park : null };
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
        guide: null,
        sheet: null,
        ...pal,
      };
      update((prev) =>
        prev.map((d, di) => {
          if (di !== targetDay) return d;
          const chip = activeId.startsWith("guide:") ? parkGuides.find((g) => g.id === activeId.slice(6)) : undefined;
          const sheet = chip && sheetFromGuide(chip, d.date);
          const placed = sheet ? { ...item, sheet, startTime: sheet.openTime, endTime: sheet.closeTime } : withSheet(item, d.date);
          return { ...d, items: [...d.items.slice(0, targetIndex), placed, ...d.items.slice(targetIndex)] };
        }),
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
        guide: hasGuide(i.type) ? cleanGuide(i.guide) : null,
        sheet: i.type === "PARK" ? i.sheet : null,
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

  // ── Guías de parques y cruceros

  /** Pide a la IA la guía de una actividad. Toma el día y la actividad como están ahora. */
  async function requestGuide(day: DayState, item: ItemState) {
    setGuideStatus((s) => ({ ...s, [item.key]: { loading: true } }));
    const res = await proposePlaceGuide(
      target.id,
      {
        type: "CRUISE",
        title: item.title,
        location: item.location,
        date: day.date,
        dayTitle: day.title,
        dayNotes: day.notes,
        notes: item.notes,
      },
      aiInstructions,
    ).catch(() => ({ error: "No se pudieron generar las recomendaciones. Intentá de nuevo." }));
    if ("guide" in res && res.guide) {
      const guide = res.guide;
      setDays((prev) => prev.map((d) => ({ ...d, items: d.items.map((i) => (i.key === item.key ? { ...i, guide } : i)) })));
      setDirty(true);
      setGuideStatus((s) => ({ ...s, [item.key]: {} }));
    } else {
      setGuideStatus((s) => ({ ...s, [item.key]: { error: "error" in res ? res.error : "No se pudieron generar las recomendaciones." } }));
    }
  }

  /** Guías para todos los parques y cruceros que todavía no tienen, de a tres a la vez. */
  async function requestGuides(source: DayState[]) {
    const queue = source.flatMap((d) => d.items.filter((i) => aiGuide(i.type) && !i.guide).map((i) => [d, i] as const));
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await requestGuide(...next);
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  const missingGuides = days.reduce((n, d) => n + d.items.filter((i) => aiGuide(i.type) && !i.guide && !guideStatus[i.key]?.loading).length, 0);

  function generate() {
    if (days.some((d) => d.items.length > 0) && !window.confirm("La propuesta de la IA va a reemplazar el itinerario actual en el editor (no se guarda hasta que hagas clic en Guardar). ¿Continuar?")) return;
    startGenerate(async () => {
      setMessage(null);
      const res = await proposeItinerary(target.id, aiInstructions, aiDetail, aiGuides);
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
              guide: i.guide,
              sheet: null,
            })),
          })),
      );
      // En la versión resumida no se suman atracciones sueltas: los imperdibles quedan en la revisión para agregarlos a mano.
      // Cada parque toma su ficha del catálogo (y el día de un evento reservado, la del evento).
      const withSheets = withSheetsAndEvents(state);
      const proposed = aiDetail === "detailed" ? withMustDos(withSheets, catalog, mustDoItem) : { days: withSheets, added: [] };
      setDays(proposed.days);
      setDirty(true);
      setAiResult({ summary: r.summary, warnings: r.warnings, knowledge: res.knowledgeUsed, added: proposed.added.map((e) => e.name) });
      // Las guías vienen en la misma respuesta; si a algún parque o día de crucero le faltó, se pide aparte.
      if (aiGuides) requestGuides(proposed.days);
      setAiOpen(false);
    });
  }

  return (
    <DndContext id="itinerary-editor" sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {/* Barra superior */}
      <div className="sticky top-[52px] z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--ground)] px-4 py-3 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
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
          {aiEnabled && missingGuides > 0 && (
            <button type="button" onClick={() => requestGuides(days)} className={buttonClass("secondary", "sm")}>
              <Sparkles className="size-4 text-brand-600" /> Recomendaciones para {missingGuides === 1 ? "1 día de crucero" : `${missingGuides} días de crucero`}
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
        <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-slate-900">Itinerario con IA</p>
              <p className="text-sm text-slate-600">
                Usa las edades de los viajeros, los intereses y el presupuesto del grupo, las reservas, los vuelos, las notas del viaje, el catálogo de parques y las novedades vigentes. No recibe nombres ni datos personales; las alturas las revisa el sistema.
              </p>
            </div>
            <button type="button" onClick={() => setAiOpen(false)} className="text-slate-500 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </div>
          <fieldset className="mt-3">
            <legend className="mb-1.5 text-xs font-semibold text-slate-500">Nivel de detalle</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <input type="checkbox" checked={aiGuides} onChange={(e) => setAiGuides(e.target.checked)} className="mt-0.5 rounded border-slate-300" />
            <span>
              <span className="font-medium text-slate-900">Sumar recomendaciones y tips en los días de crucero</span>
              <span className="block text-xs text-slate-500">
                Se arman según los viajeros y estas instrucciones. Los parques llevan siempre su ficha del catálogo (y el día de un evento reservado, la del evento).
              </span>
            </span>
          </label>
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
        <div className="mb-4 rounded-lg border border-brand-200 bg-white p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-slate-900">Propuesta de la IA</p>
            <button type="button" onClick={() => setAiResult(null)} className="text-slate-500 hover:text-slate-700">
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
        <div className={clsx("mb-4 rounded-lg border p-4 text-sm", checks.count + checks.missing.length > 0 ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60")}>
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <ShieldCheck className={clsx("size-4", checks.count + checks.missing.length > 0 ? "text-amber-700" : "text-emerald-700")} />
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
                  <Plus className="size-3" /> {m.entry.name} <span className="text-slate-500">· día {m.dayIndex + 1}</span>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
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
          {parkGuides.length > 0 && (
            <div>
              <p className="label">Parques y eventos</p>
              <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto lg:flex-col">
                {parkGuides.map((g) => (
                  <PaletteChip key={g.id} id={`guide:${g.id}`} label={g.kind === "EVENT" ? `Evento: ${g.name}` : g.name} type="PARK" />
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Se suman con su ficha: horarios, imperdibles, shows, dónde comer y tips.</p>
            </div>
          )}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="label mb-0">Actividades guardadas</p>
              {/* En otra pestaña, para no perder lo que no se guardó del itinerario. */}
              <a href="/app/actividades" target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-700 hover:underline">
                Administrar
              </a>
            </div>
            {templates.length > 0 ? (
              <div className="flex max-h-80 flex-wrap gap-1.5 overflow-y-auto lg:flex-col">
                {templates.map((t) => (
                  <PaletteChip key={t.id} id={`tpl:${t.id}`} label={t.title} type={t.type} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Guardá las actividades que más usás desde cualquier actividad del itinerario.</p>
            )}
          </div>
        </aside>

        {/* Días */}
        <div className="space-y-4">
          {days.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              {startDate && endDate ? "Generá los días según las fechas del viaje o agregalos a mano." : "Agregá el primer día."}
            </div>
          )}
          {days.map((day, di) => (
            <DayColumn
              key={day.key}
              day={day}
              number={di + 1}
              warnings={checks.itemWarnings[di] ?? []}
              guideStatus={guideStatus}
              aiEnabled={aiEnabled}
              travelers={travelers}
              catalog={catalog}
              parkGuides={parkGuides}
              pendingEvents={pendingEvents(day)}
              onAddEvent={(g) => update((prev) => prev.map((d) => (d.key === day.key ? placeEvent(d, g) : d)))}
              onGuide={(item) => requestGuide(day, item)}
              onTemplateSaved={(t) => setTemplates((prev) => [...prev, t].sort((a, b) => a.title.localeCompare(b.title)))}
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
  guideStatus,
  aiEnabled,
  travelers,
  catalog,
  parkGuides,
  pendingEvents,
  onAddEvent,
  onGuide,
  onTemplateSaved,
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
  guideStatus: Record<string, GuideStatus>;
  aiEnabled: boolean;
  travelers: CheckTraveler[];
  catalog: CheckEntry[];
  parkGuides: GuideOption[];
  pendingEvents: GuideOption[];
  onAddEvent: (g: GuideOption) => void;
  onGuide: (item: ItemState) => void;
  onTemplateSaved: (t: EditorTemplate) => void;
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
    <section className={clsx("rounded-lg border bg-white transition-colors", isOver ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200")}>
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="rounded-md bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">Día {number}</span>
        <DateInput value={day.date ?? ""} onChange={(v) => onPatch({ date: v || null })} placeholder="Sin fecha" size="sm" className="w-44" />
        <span className="hidden text-xs text-slate-500 first-letter:uppercase sm:inline-block">{prettyDate(day.date)}</span>
        <input
          value={day.title ?? ""}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="Parque o lugar del día"
          className="min-w-40 flex-1 rounded-md border border-transparent px-2 py-0.5 text-sm font-medium text-slate-900 hover:border-slate-200 focus:border-brand-400 focus:outline-none"
        />
        <button type="button" onClick={onSort} className="text-slate-500 hover:text-slate-700" title="Ordenar por horario">
          <ArrowDownUp className="size-4" />
        </button>
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-rose-600" title="Eliminar día">
          <Trash2 className="size-4" />
        </button>
      </header>
      <div ref={setNodeRef} className="space-y-2 p-3">
        {pendingEvents.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onAddEvent(g)}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 hover:border-amber-500"
          >
            <PartyPopper className="size-4 shrink-0" />
            <span>
              Este día tienen reservado <strong>{g.name}</strong>
              {g.park && ` en ${g.park}`}. <span className="font-medium underline">Sumarlo con su ficha y sus horarios</span>
              {eventDateWarning(g, day.date) && <span className="mt-0.5 block text-amber-800">{eventDateWarning(g, day.date)}</span>}
            </span>
          </button>
        ))}
        <SortableContext items={day.items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          {day.items.map((item, ii) => (
            <SortableItem
              key={item.key}
              item={item}
              warnings={warnings[ii] ?? []}
              guideStatus={guideStatus[item.key] ?? {}}
              aiEnabled={aiEnabled}
              travelers={travelers}
              catalog={catalog}
              parkGuides={parkGuides}
              date={day.date}
              onGuide={() => onGuide(item)}
              onTemplateSaved={onTemplateSaved}
              open={editing === item.key}
              onToggle={() => setEditing(editing === item.key ? null : item.key)}
              onPatch={(p) => onPatchItem(item.key, p)}
              onRemove={() => onRemoveItem(item.key)}
            />
          ))}
        </SortableContext>
        {day.items.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-500">Soltá actividades acá</p>}
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
  guideStatus,
  aiEnabled,
  travelers,
  catalog,
  parkGuides,
  date,
  onGuide,
  onTemplateSaved,
  open,
  onToggle,
  onPatch,
  onRemove,
}: {
  item: ItemState;
  warnings: ItemWarning[];
  guideStatus: GuideStatus;
  aiEnabled: boolean;
  travelers: CheckTraveler[];
  catalog: CheckEntry[];
  parkGuides: GuideOption[];
  date: string | null;
  onGuide: () => void;
  onTemplateSaved: (t: EditorTemplate) => void;
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
        <button type="button" {...listeners} {...attributes} className="cursor-grab text-slate-500 active:cursor-grabbing" title="Arrastrar">
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
        <div className="grid grid-cols-1 gap-2 border-t border-white/60 bg-white/70 p-3 sm:grid-cols-6">
          <input className="field sm:col-span-3" value={item.title} onChange={(e) => onPatch({ title: e.target.value })} placeholder="Título" autoFocus />
          <SelectField className="sm:col-span-1" value={item.type} onValueChange={(v) => onPatch({ type: v as ActivityType })} options={ACTIVITY_TYPES} aria-label="Tipo de actividad" />
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
          <SaveAsTemplate item={item} onSaved={onTemplateSaved} />
        </div>
      )}
      {item.type === "PARK" && <ParkSection item={item} date={date} guides={parkGuides} travelers={travelers} catalog={catalog} onPatch={onPatch} />}
      {aiGuide(item.type) && (
        <GuideSection item={item} status={guideStatus} aiEnabled={aiEnabled} travelers={travelers} catalog={catalog} onGuide={onGuide} onPatch={onPatch} />
      )}
    </div>
  );
}

/** Opciones de fichas para elegir: parques y eventos, del destino del viaje primero. */
function GuideSelect({ guides, value, onPick, placeholder }: { guides: GuideOption[]; value?: string; onPick: (g: GuideOption) => void; placeholder: string }) {
  const groups = (["PARK", "EVENT"] as const)
    .map((kind) => ({
      label: kind === "PARK" ? "Parques" : "Eventos especiales",
      options: guides.filter((g) => g.kind === kind).map((g) => ({ value: g.id, label: kind === "EVENT" ? eventTitle(g) : g.name })),
    }))
    .filter((g) => g.options.length > 0);
  return (
    <SelectField
      size="sm"
      className="w-64 max-w-full"
      value={value ?? ""}
      placeholder={placeholder}
      groups={groups}
      onValueChange={(v) => {
        const g = guides.find((x) => x.id === v);
        if (g) onPick(g);
      }}
    />
  );
}

/**
 * Ficha del parque (o del evento) en el itinerario: se trae del catálogo y el agente la edita entera
 * para este viaje, la cambia por otra, la restaura o la quita.
 */
function ParkSection({
  item,
  date,
  guides,
  travelers,
  catalog,
  onPatch,
}: {
  item: ItemState;
  date: string | null;
  guides: GuideOption[];
  travelers: CheckTraveler[];
  catalog: CheckEntry[];
  onPatch: (p: Partial<ItemState>) => void;
}) {
  const [editingSheet, setEditingSheet] = useState(false);
  // Cierres del catálogo y de las novedades: el viajero ve esas atracciones tachadas.
  const closedNote = closedNoteFor(catalog, date);
  const sheet = item.sheet;
  const base = sheet?.guideId ? guides.find((g) => g.id === sheet.guideId) : undefined;
  const use = (g: GuideOption) => {
    const next = sheetFromGuide(g, date);
    onPatch({
      sheet: next,
      guide: null,
      ...(g.kind === "EVENT" ? { title: eventTitle(g), location: g.park } : {}),
      ...(next.openTime || next.closeTime ? { startTime: next.openTime, endTime: next.closeTime } : {}),
    });
  };

  if (!sheet) {
    return (
      <div className="space-y-2 px-3 pb-3">
        {/* Itinerarios viejos: recomendaciones de la IA, hasta que se reemplacen por la ficha. */}
        {item.guide && <PlaceGuideCard guide={item.guide} onRemovePick={(index) => onPatch({ guide: { ...item.guide!, picks: item.guide!.picks.filter((_, i) => i !== index) } })} />}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-brand-300 bg-white/70 px-3 py-2 text-xs text-slate-600">
          <FerrisWheel className="size-4 text-brand-600" />
          <span>{item.guide ? "Reemplazar por la ficha del catálogo:" : "Sumá la ficha del parque (horarios, imperdibles, shows, dónde comer y tips):"}</span>
          {guides.length > 0 && <GuideSelect guides={guides} onPick={use} placeholder="Elegí el parque o evento" />}
          <button
            type="button"
            onClick={() => {
              onPatch({ sheet: emptySheet(item.title), guide: null });
              setEditingSheet(true);
            }}
            className="font-medium text-brand-700 hover:underline"
          >
            Armarla a mano
          </button>
        </div>
      </div>
    );
  }

  const isClosed = (s: ParkSheet["sections"][number], name: string) => !["DINING", "SNACKS", "CHARACTERS", "TIPS"].includes(s.kind) && !!closedNote?.(name);
  const eventWarning = base ? eventDateWarning(base, date) : null;
  const closedCount = sheet.sections.reduce((n, s) => n + s.items.filter((it) => isClosed(s, it.name)).length, 0);
  const removeClosed = () => onPatch({ sheet: { ...sheet, sections: sheet.sections.map((s) => ({ ...s, items: s.items.filter((it) => !isClosed(s, it.name)) })) } });

  // Quién del grupo no llega a la altura de los imperdibles (lo ve solo el agente).
  const short = sheet.sections
    .filter((s) => s.kind === "MUST_DO" || s.kind === "CLASSICS")
    .flatMap((s) => s.items)
    .flatMap((it) => {
      const entry = matchEntry({ type: "RIDE", title: it.name, location: null }, catalog);
      if (!entry?.minHeightIn) return [];
      const who = travelers.filter((t) => t.heightCm && t.heightCm < minHeightCm(entry.minHeightIn!));
      return who.length ? [`${entry.name}: ${who.map((t) => `${t.name} (${t.heightCm} cm)`).join(" y ")} no ${who.length > 1 ? "llegan" : "llega"} a ${minHeightCm(entry.minHeightIn)} cm`] : [];
    });

  return (
    <div className="px-3 pb-3">
      {editingSheet ? (
        <div className="rounded-lg bg-white p-3 ring-1 ring-brand-200">
          <ParkSheetForm sheet={sheet} onChange={(next) => onPatch({ sheet: next })} />
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => setEditingSheet(false)} className={buttonClass("secondary", "sm")}>
              Listo
            </button>
          </div>
        </div>
      ) : (
        <ParkSheetCard sheet={sheet} closedNote={closedNote} />
      )}
      {eventWarning && (
        <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {eventWarning} Revisá la fecha de la reserva o del día.
        </p>
      )}
      {closedCount > 0 && !editingSheet && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-rose-700">
          <AlertTriangle className="size-3 shrink-0" />
          {closedCount === 1 ? "1 atracción de la ficha está cerrada ese día: el cliente la ve tachada." : `${closedCount} atracciones de la ficha están cerradas ese día: el cliente las ve tachadas.`}
          <button type="button" onClick={removeClosed} className="font-medium underline hover:text-rose-900">
            {closedCount === 1 ? "Quitarla de la ficha" : "Quitarlas de la ficha"}
          </button>
        </p>
      )}
      {short.length > 0 && !editingSheet && (
        <ul className="mt-1.5 space-y-0.5">
          {short.map((t) => (
            <li key={t} className="flex items-start gap-1 text-xs text-rose-700">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {t}: rider switch.
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1.5 flex flex-wrap items-center justify-end gap-3 text-xs">
        {!editingSheet && (
          <button type="button" onClick={() => setEditingSheet(true)} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
            <Pencil className="size-3" /> Editar ficha
          </button>
        )}
        {guides.length > 0 && <GuideSelect guides={guides} onPick={(g) => window.confirm(`¿Cambiar por la ficha de ${g.name}? Se pierden los cambios que le hiciste a esta.`) && use(g)} placeholder="Cambiar ficha…" />}
        {base && (
          <button
            type="button"
            onClick={() => window.confirm("¿Volver a la ficha del catálogo? Se pierden los cambios que le hiciste para este viaje.") && use(base)}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-brand-700"
          >
            <RotateCcw className="size-3" /> Restaurar del catálogo
          </button>
        )}
        <button type="button" onClick={() => onPatch({ sheet: null })} className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600">
          <Trash2 className="size-3" /> Quitar ficha
        </button>
      </div>
    </div>
  );
}

function GuideSection({
  item,
  status,
  aiEnabled,
  travelers,
  catalog,
  onGuide,
  onPatch,
}: {
  item: ItemState;
  status: GuideStatus;
  aiEnabled: boolean;
  travelers: CheckTraveler[];
  catalog: CheckEntry[];
  onGuide: () => void;
  onPatch: (p: Partial<ItemState>) => void;
}) {
  const [editingGuide, setEditingGuide] = useState(false);
  const guide = item.guide;
  const place = item.type === "CRUISE" ? "este día de crucero" : "este parque";
  if (status.loading) {
    return (
      <div className="px-3 pb-3">
        <p className="flex animate-pulse items-center gap-2 rounded-lg bg-white/80 px-3 py-2.5 text-xs text-brand-700">
          <Sparkles className="size-4" /> Armando recomendaciones y tips para {place}…
        </p>
      </div>
    );
  }
  if (!guide) {
    return (
      <div className="px-3 pb-3">
        <div className="flex flex-wrap gap-2">
          {aiEnabled && (
            <button
              type="button"
              onClick={onGuide}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-white/70 px-3 py-2 text-xs font-medium text-brand-700 hover:border-brand-500 hover:bg-white"
            >
              <Sparkles className="size-3.5" /> Sumar atracciones recomendadas y tips con IA
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onPatch({ guide: { picks: [], tips: [] } });
              setEditingGuide(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-xs font-medium text-slate-600 hover:border-slate-400 hover:bg-white"
          >
            <Pencil className="size-3.5" /> Escribirlas a mano
          </button>
        </div>
        {status.error && <p className="mt-1.5 text-xs text-rose-700">{status.error}</p>}
      </div>
    );
  }

  if (editingGuide) {
    return <GuideForm guide={guide} catalog={catalog} onChange={(g) => onPatch({ guide: g })} onDone={() => setEditingGuide(false)} />;
  }

  // Quién del grupo no llega a la altura de cada recomendación (lo ve solo el agente).
  const pickNotes = guide.picks.map((p) => {
    if (!p.minHeightIn) return null;
    const short = travelers.filter((t) => t.heightCm && t.heightCm < minHeightCm(p.minHeightIn!));
    return short.length ? `${short.map((t) => `${t.name} (${t.heightCm} cm)`).join(" y ")} no ${short.length > 1 ? "llegan" : "llega"}: rider switch.` : null;
  });
  return (
    <div className="px-3 pb-3">
      <PlaceGuideCard
        guide={guide}
        cruise={item.type === "CRUISE"}
        pickNotes={pickNotes}
        onRemovePick={(index) => onPatch({ guide: { ...guide, picks: guide.picks.filter((_, i) => i !== index) } })}
        onRemoveTip={(index) => onPatch({ guide: { ...guide, tips: guide.tips.filter((_, i) => i !== index) } })}
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-end gap-3 text-xs">
        {status.error && <span className="mr-auto text-rose-700">{status.error}</span>}
        <button type="button" onClick={() => setEditingGuide(true)} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
          <Pencil className="size-3" /> Editar
        </button>
        {aiEnabled && (
          <button
            type="button"
            onClick={() => window.confirm("¿Reemplazar estas recomendaciones por unas nuevas de la IA? Se pierden los cambios que les hiciste.") && onGuide()}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-brand-700"
          >
            <RefreshCw className="size-3" /> Regenerar con IA
          </button>
        )}
        <button type="button" onClick={() => onPatch({ guide: null })} className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600">
          <Trash2 className="size-3" /> Quitar recomendaciones
        </button>
      </div>
    </div>
  );
}

/** Edición de la guía: cada recomendación (nombre, tipo, por qué) y cada tip, más agregar y ordenar. */
function GuideForm({ guide, catalog, onChange, onDone }: { guide: PlaceGuide; catalog: CheckEntry[]; onChange: (g: PlaceGuide) => void; onDone: () => void }) {
  function patchPick(index: number, patch: Partial<GuidePick>) {
    onChange({ ...guide, picks: guide.picks.map((p, i) => (i === index ? { ...p, ...patch } : p)) });
  }
  function renamePick(index: number, name: string) {
    // La altura mínima y el imperdible salen del catálogo, no de lo que se escribe.
    const entry = matchEntry({ type: "RIDE", title: name, location: null }, catalog);
    const kind = entry ? (entry.kind === "SHOW" ? "SHOW" : "RIDE") : guide.picks[index].kind;
    patchPick(index, { name, kind, minHeightIn: entry?.minHeightIn ?? null, mustDo: entry?.mustDo ?? false });
  }
  function movePick(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= guide.picks.length) return;
    onChange({ ...guide, picks: arrayMove(guide.picks, index, to) });
  }
  const listId = useMemo(() => newKey("catalog"), []);
  return (
    <div className="mx-3 mb-3 space-y-3 rounded-lg bg-white p-3 ring-1 ring-brand-200">
      <datalist id={listId}>
        {catalog.map((e) => (
          <option key={e.id} value={e.name}>
            {e.area}
          </option>
        ))}
      </datalist>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-brand-700">Recomendaciones</p>
        <ul className="space-y-2">
          {guide.picks.map((p, i) => (
            <li key={i} className="grid grid-cols-1 gap-1.5 rounded-lg bg-slate-50 p-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
              <input className="field" value={p.name} onChange={(e) => renamePick(i, e.target.value)} list={listId} placeholder="Atracción, show, restaurante…" />
              <SelectField value={p.kind} onValueChange={(v) => patchPick(i, { kind: v as GuidePickKind })} options={GUIDE_PICK_KINDS.map((k) => ({ value: k, label: GUIDE_PICK_LABEL[k] }))} aria-label="Tipo" />
              <div className="flex items-center justify-end gap-1 text-slate-500">
                <button type="button" onClick={() => movePick(i, -1)} disabled={i === 0} className="p-1 hover:text-slate-700 disabled:opacity-30" title="Subir">
                  <ChevronUp className="size-4" />
                </button>
                <button type="button" onClick={() => movePick(i, 1)} disabled={i === guide.picks.length - 1} className="p-1 hover:text-slate-700 disabled:opacity-30" title="Bajar">
                  <ChevronDown className="size-4" />
                </button>
                <button type="button" onClick={() => onChange({ ...guide, picks: guide.picks.filter((_, j) => j !== i) })} className="p-1 hover:text-rose-600" title="Quitar">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <textarea className="field sm:col-span-3" rows={2} value={p.why} onChange={(e) => patchPick(i, { why: e.target.value })} placeholder="Por qué se la recomendás a esta familia" />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => onChange({ ...guide, picks: [...guide.picks, { name: "", kind: "RIDE", why: "", minHeightIn: null, mustDo: false }] })}
          className="mt-1.5 text-xs font-medium text-brand-700 hover:underline"
        >
          + Agregar recomendación
        </button>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-amber-800">Tips</p>
        <ul className="space-y-1.5">
          {guide.tips.map((t, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <textarea
                className="field flex-1"
                rows={2}
                value={t}
                onChange={(e) => onChange({ ...guide, tips: guide.tips.map((x, j) => (j === i ? e.target.value : x)) })}
                placeholder="Un consejo práctico para ese día"
              />
              <button type="button" onClick={() => onChange({ ...guide, tips: guide.tips.filter((_, j) => j !== i) })} className="p-1 pt-2 text-slate-500 hover:text-rose-600" title="Quitar">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => onChange({ ...guide, tips: [...guide.tips, ""] })} className="mt-1.5 text-xs font-medium text-brand-700 hover:underline">
          + Agregar tip
        </button>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onDone} className={buttonClass("secondary", "sm")}>
          Listo
        </button>
      </div>
    </div>
  );
}

/** Minutos entre dos horarios HH:MM (null si falta alguno o el fin no es posterior). */
function minutesBetween(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const diff = toMin(end) - toMin(start);
  return diff > 0 ? diff : null;
}

/** Guarda la actividad en "Actividades guardadas" para arrastrarla a otros itinerarios. */
function SaveAsTemplate({ item, onSaved }: { item: ItemState; onSaved: (t: EditorTemplate) => void }) {
  const [state, setState] = useState<{ saved?: string; error?: string }>({});
  const [pending, startSaving] = useTransition();
  const done = state.saved === `${item.type}|${item.title}|${item.location}|${item.notes}`;
  function save() {
    startSaving(async () => {
      const res = await saveActivityFromItinerary({
        type: item.type,
        title: item.title,
        location: item.location,
        notes: item.notes,
        durationMin: minutesBetween(item.startTime, item.endTime),
      });
      if ("template" in res && res.template) {
        onSaved(res.template);
        setState({ saved: `${item.type}|${item.title}|${item.location}|${item.notes}` });
      } else setState({ error: "error" in res ? res.error : "No se pudo guardar." });
    });
  }
  return (
    <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
      <button type="button" onClick={save} disabled={pending || done || !item.title.trim()} className={buttonClass("secondary", "sm")}>
        <BookmarkPlus className="size-4" /> {done ? "Guardada en mis actividades" : pending ? "Guardando…" : "Guardar en mis actividades"}
      </button>
      <span className="text-xs text-slate-500">{state.error ?? "Para reusarla en otros itinerarios. La IA también la tiene en cuenta."}</span>
    </div>
  );
}
