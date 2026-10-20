// Ficha de un parque o de un evento especial dentro del itinerario: horarios, llegada recomendada,
// show principal y secciones estandarizadas (imperdibles, leves, shows, personajes, dónde comer,
// snacks, tips…). Las fichas base las mantiene el equipo de la plataforma en el catálogo (ParkGuide);
// al sumar un parque al itinerario se copia la ficha y el agente la edita para ese viaje.
// Sin dependencias de servidor: se usa en el editor, en las vistas y en el servidor.
import { z } from "zod";

export const SECTION_KINDS = ["MUST_DO", "CLASSICS", "MILD", "SHOWS", "CHARACTERS", "DINING", "SNACKS", "TIPS", "AREA", "OTHER"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Título por defecto de cada tipo de sección (el agente lo puede cambiar). */
export const SECTION_LABEL: Record<SectionKind, string> = {
  MUST_DO: "Atracciones imperdibles",
  CLASSICS: "Clásicos",
  MILD: "Atracciones leves",
  SHOWS: "Shows y desfiles",
  CHARACTERS: "Personajes",
  DINING: "Dónde comer",
  SNACKS: "Snacks únicos",
  TIPS: "Tips para disfrutar el día",
  AREA: "Zona del parque",
  OTHER: "Otra sección",
};

/** Qué se escribe en el detalle de cada ítem, según la sección (de ayuda en el formulario). */
export const SECTION_DETAIL_HINT: Record<SectionKind, string> = {
  MUST_DO: "Montaña rusa intensa, simulador, paseo con caída…",
  CLASSICS: "Paseo familiar, paseo de terror…",
  MILD: "Opcional",
  SHOWS: "Dónde y de qué se trata",
  CHARACTERS: "Dónde encontrarlos",
  DINING: "Zona y qué comer",
  SNACKS: "Dónde se consigue",
  TIPS: "",
  AREA: "Tipo de atracción o qué hacer",
  OTHER: "Opcional",
};

/** Secciones que usan horario por ítem (shows y desfiles). */
export const TIMED_SECTIONS: SectionKind[] = ["SHOWS"];

const SheetItemSchema = z.object({
  name: z.string().max(300),
  detail: z.string().max(500).catch(""),
  time: z.string().max(100).catch(""),
});

const SheetSectionSchema = z.object({
  kind: z.enum(SECTION_KINDS).catch("OTHER"),
  title: z.string().max(120),
  items: z.array(SheetItemSchema).max(60),
  note: z.string().max(500).catch(""),
});

const time = z.string().regex(/^\d{2}:\d{2}$/).nullable().catch(null);

export const ParkSheetSchema = z.object({
  v: z.literal(2),
  /** Ficha base del catálogo de la que salió (para restaurarla). */
  guideId: z.string().nullable().catch(null),
  kind: z.enum(["PARK", "EVENT"]).catch("PARK"),
  name: z.string().max(200),
  /** En un evento, el parque donde se hace. */
  park: z.string().max(200).nullable().catch(null),
  openTime: time,
  closeTime: time,
  hoursNote: z.string().max(300).catch(""),
  arrival: z.string().max(200).catch(""),
  mainShow: z.string().max(200).catch(""),
  sections: z.array(SheetSectionSchema).max(20),
});

export type ParkSheet = z.infer<typeof ParkSheetSchema>;
export type SheetSection = ParkSheet["sections"][number];
export type SheetItem = SheetSection["items"][number];

/** Las secciones de una ficha base (JSON del catálogo), validadas. */
export function parseSections(value: unknown): SheetSection[] {
  const parsed = z.array(SheetSectionSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** La ficha guardada en una actividad del itinerario (JSON), o null si es otra cosa (p. ej. una guía de crucero). */
export function parseSheet(value: unknown): ParkSheet | null {
  if (!value || typeof value !== "object" || (value as { v?: unknown }).v !== 2) return null;
  const parsed = ParkSheetSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** La ficha como se guarda: sin ítems ni secciones vacías. */
export function cleanSheet(sheet: ParkSheet): ParkSheet {
  const sections = sheet.sections
    .map((s) => ({
      ...s,
      title: s.title.trim() || SECTION_LABEL[s.kind],
      note: s.note.trim(),
      items: s.items.map((i) => ({ name: i.name.trim(), detail: i.detail.trim(), time: i.time.trim() })).filter((i) => i.name),
    }))
    .filter((s) => s.items.length > 0 || s.note);
  return { ...sheet, name: sheet.name.trim(), hoursNote: sheet.hoursNote.trim(), arrival: sheet.arrival.trim(), mainShow: sheet.mainShow.trim(), sections };
}

const ScheduleEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  openTime: time,
  closeTime: time,
  note: z.string().max(200).catch(""),
});

/** Horario de un parque o evento en una fecha (las fichas base guardan varios: ver ParkGuide.schedule). */
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;

/** Los horarios por fecha de una ficha base (JSON), ordenados y sin repetir fechas. */
export function parseSchedule(value: unknown): ScheduleEntry[] {
  if (!Array.isArray(value)) return [];
  const byDate = new Map<string, ScheduleEntry>();
  for (const v of value) {
    const parsed = ScheduleEntrySchema.safeParse(v);
    if (parsed.success) byDate.set(parsed.data.date, parsed.data);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** "Hoy" en Orlando (YYYY-MM-DD): los horarios de los parques se cargan con la fecha local. */
export const todayInOrlando = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

/** Ficha base del catálogo, tal como llega al editor. */
export type GuideOption = {
  id: string;
  kind: "PARK" | "EVENT";
  destination: string;
  name: string;
  park: string | null;
  aliases: string[];
  openTime: string | null;
  closeTime: string | null;
  hoursNote: string | null;
  arrival: string | null;
  mainShow: string | null;
  sections: SheetSection[];
  schedule: ScheduleEntry[];
};

/** Copia de la ficha base para un día del itinerario: con el horario cargado para esa fecha, si lo hay. */
export function sheetFromGuide(g: GuideOption, date?: string | null): ParkSheet {
  const day = date ? g.schedule.find((s) => s.date === date) : undefined;
  return {
    v: 2,
    guideId: g.id,
    kind: g.kind,
    name: g.name,
    park: g.park,
    openTime: day ? day.openTime : g.openTime,
    closeTime: day ? day.closeTime : g.closeTime,
    // El horario del día ya no es "de referencia": queda la nota de ese día (Early Entry, cierre por fiesta…).
    hoursNote: day ? day.note : (g.hoursNote ?? ""),
    arrival: g.arrival ?? "",
    mainShow: g.mainShow ?? "",
    sections: structuredClone(g.sections),
  };
}

export const emptySheet = (name: string): ParkSheet => ({
  v: 2,
  guideId: null,
  kind: "PARK",
  name,
  park: null,
  openTime: null,
  closeTime: null,
  hoursNote: "",
  arrival: "",
  mainShow: "",
  sections: [],
});

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** ¿El texto nombra a la ficha (por su nombre o un alias, como palabras completas)? Devuelve el largo de lo que coincidió. */
function mentions(text: string, g: GuideOption) {
  const t = ` ${norm(text)} `;
  return Math.max(0, ...[g.name, ...g.aliases].map((n) => norm(n)).filter((n) => n.length >= 2 && t.includes(` ${n} `)).map((n) => n.length));
}

/** La ficha de parque que corresponde a un título ("Magic Kingdom", "Día en EPCOT"…), la que coincide más. */
export function matchParkGuide(text: string, guides: GuideOption[]) {
  let best: GuideOption | null = null;
  let score = 0;
  for (const g of guides) {
    if (g.kind !== "PARK") continue;
    const s = mentions(text, g);
    if (s > score) [best, score] = [g, s];
  }
  return best;
}

/** El evento especial que nombra una reserva ("Mickey's Not-So-Scary Halloween Party 31/10"). */
export function matchEventGuide(text: string, guides: GuideOption[], destinations?: string[]) {
  let best: GuideOption | null = null;
  let score = 0;
  for (const g of guides) {
    if (g.kind !== "EVENT" || (destinations?.length && !destinations.includes(g.destination))) continue;
    const s = mentions(text, g);
    if (s > score) [best, score] = [g, s];
  }
  return best;
}

/**
 * Si un evento tiene fechas cargadas y la fecha elegida no es una de ellas: la fecha cargada anterior y
 * la siguiente más cercanas (para avisar). null si no hay fechas cargadas o si la fecha está.
 */
export function eventDateMismatch(g: Pick<GuideOption, "kind" | "schedule">, date: string | null) {
  if (g.kind !== "EVENT" || !date || g.schedule.length === 0 || g.schedule.some((s) => s.date === date)) return null;
  const prev = [...g.schedule].reverse().find((s) => s.date < date) ?? null;
  const next = g.schedule.find((s) => s.date > date) ?? null;
  return { prev, next };
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const hours = (s: ScheduleEntry) => (s.openTime && s.closeTime ? ` (${s.openTime}–${s.closeTime})` : "");

/** "Mickey's Not-So-Scary Halloween Party no figura el 21/10. Fechas cercanas: 20/10 (19:00–00:00) y 23/10 (19:00–00:00)." */
export function eventDateWarning(g: Pick<GuideOption, "kind" | "schedule" | "name">, date: string | null) {
  const m = eventDateMismatch(g, date);
  if (!m) return null;
  const near = [m.prev, m.next].filter((x): x is ScheduleEntry => !!x).map((x) => `${dm(x.date)}${hours(x)}`);
  return `${g.name} no figura el ${dm(date!)} entre las fechas cargadas.${near.length ? ` ${near.length > 1 ? "Fechas cercanas" : "Fecha más cercana"}: ${near.join(" y ")}.` : ""}`;
}

/** Evento especial reservado para un día del viaje (sale de las reservas de tipo evento). */
export type TripEvent = { date: string; guideId: string; title: string };

/** Título de la actividad del día de un evento: "Magic Kingdom · Mickey's Not-So-Scary Halloween Party". */
export const eventTitle = (g: Pick<GuideOption, "name" | "park">) => (g.park ? `${g.park} · ${g.name}` : g.name);

/** La ficha que corresponde a un parque en una fecha: la del evento si ese día hay uno en ese parque. */
export function sheetForPark(title: string, date: string | null, guides: GuideOption[], events: TripEvent[]) {
  const park = matchParkGuide(title, guides);
  const event = date
    ? events
        .filter((e) => e.date === date)
        .map((e) => guides.find((g) => g.id === e.guideId))
        .find((g) => g && (!park || !g.park || norm(g.park) === norm(park.name)))
    : undefined;
  if (event) return { guide: event, title: eventTitle(event) };
  return park ? { guide: park, title: null } : null;
}

/** Nombres de todo lo que recomienda una ficha (para la revisión de imperdibles). */
export const sheetNames = (sheet: ParkSheet) => sheet.sections.filter((s) => s.kind !== "TIPS").flatMap((s) => s.items.map((i) => i.name));
