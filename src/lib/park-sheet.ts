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
};

/** Copia de la ficha base para un día del itinerario. */
export function sheetFromGuide(g: GuideOption): ParkSheet {
  return {
    v: 2,
    guideId: g.id,
    kind: g.kind,
    name: g.name,
    park: g.park,
    openTime: g.openTime,
    closeTime: g.closeTime,
    hoursNote: g.hoursNote ?? "",
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
