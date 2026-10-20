// Lee los horarios de los parques a partir del texto copiado de las páginas oficiales: el admin las
// abre, copia y pega. No se consultan los sitios desde el servidor. Funciones puras (se usan en el navegador).
// - Walt Disney World: "Calendario de 5 días" (disneyworld.disney.go.com/es-pe/calendars/five-day).
// - Universal Orlando: "Horarios de los Parques" (universalorlando.com/web/es/us/plan-your-visit/
//   hours-information/park-hours), que muestra un día a la vez: se pueden pegar varios días seguidos.

export type HoursDay = {
  date: string; // YYYY-MM-DD
  open: string | null;
  close: string | null;
  earlyEntry: string | null; // "8:30"
  /** Nombre del ingreso anticipado: "Early Entry" (Disney) o "Early Park Admission" (Universal). */
  earlyLabel?: string;
  /** Evento con entrada aparte esa noche (fiestas, After Hours…). */
  event: { open: string; close: string } | null;
  /** Horario nocturno extendido (huéspedes de hoteles Deluxe). */
  extended: { open: string; close: string } | null;
};

export type HoursPark = { park: string; days: HoursDay[] };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const LABELS = {
  "Ingreso temprano": "early",
  "Horarios de los Parques": "hours",
  "Evento requiere un ticket especial": "event",
  "Horario nocturno extendido": "extended",
} as const;

const hhmm = (t: string) => t.padStart(5, "0");

/** La fecha "20, octubre" sin año: el año que la deja más cerca de hoy. */
function dateOf(day: number, month: string, today: string) {
  const m = MONTHS.indexOf(month.toLowerCase());
  if (m < 0) return null;
  const base = Number(today.slice(0, 4));
  const candidates = [base - 1, base, base + 1].map((y) => `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  const dist = (iso: string) => Math.abs(Date.parse(iso) - Date.parse(today));
  return candidates.sort((a, b) => dist(a) - dist(b))[0];
}

/**
 * Parques y horarios por día del texto pegado. Cada parque empieza con su nombre y la línea "Horas";
 * cada dato es una etiqueta ("Horarios de los Parques") seguida de "9:00 a 22:00, martes, 20, octubre"
 * (o "-: …" si ese día no hay).
 */
export function parseDisneyFiveDay(text: string, today: string): HoursPark[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const parks: HoursPark[] = [];
  let current: HoursPark | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i + 1] === "Horas" && lines[i] && !(lines[i] in LABELS)) {
      current = { park: lines[i], days: [] };
      parks.push(current);
      i++;
      continue;
    }
    const kind = LABELS[lines[i] as keyof typeof LABELS];
    if (!current || !kind) continue;
    const m = lines[i + 1]?.match(/^(?:(\d{1,2}:\d{2}) a (\d{1,2}:\d{2})|-):?,?\s*[^,]+,\s*(\d{1,2}),\s*([a-záéíóú]+)/i);
    if (!m) continue;
    const date = dateOf(Number(m[3]), m[4], today);
    if (!date) continue;
    let day = current.days.find((d) => d.date === date);
    if (!day) {
      day = { date, open: null, close: null, earlyEntry: null, event: null, extended: null };
      current.days.push(day);
    }
    if (!m[1]) continue;
    const [from, to] = [hhmm(m[1]), hhmm(m[2])];
    if (kind === "hours") [day.open, day.close] = [from, to];
    if (kind === "early") day.earlyEntry = from.replace(/^0/, "");
    if (kind === "event") day.event = { open: from, close: to };
    if (kind === "extended") day.extended = { open: from, close: to };
  }
  return parks.filter((p) => p.days.length > 0).map((p) => ({ ...p, days: p.days.sort((a, b) => a.date.localeCompare(b.date)) }));
}

/** Nota del día para la ficha del parque: ingreso anticipado, evento esa noche, horario extendido. */
export function dayNote(d: HoursDay) {
  return [
    d.earlyEntry && (d.earlyLabel === "Early Park Admission" ? `Early Park Admission desde las ${d.earlyEntry} (huéspedes de hoteles Universal)` : `Early Entry desde las ${d.earlyEntry} (huéspedes de hoteles Disney)`),
    d.event && `Esa noche hay un evento con entrada aparte de ${d.event.open.replace(/^0/, "")} a ${d.event.close.replace(/^0/, "")}`,
    d.extended && `Horario nocturno extendido de ${d.extended.open.replace(/^0/, "")} a ${d.extended.close.replace(/^0/, "")} (huéspedes de hoteles Deluxe)`,
  ]
    .filter(Boolean)
    .join(". ");
}

/** "9:00 a.m." → "09:00"; "12:00 a.m." → "00:00". */
function to24(h: string, m: string, ap: string) {
  let hour = Number(h) % 12;
  if (ap.toLowerCase() === "p") hour += 12;
  return `${String(hour).padStart(2, "0")}:${m}`;
}

/**
 * Parques y horarios del texto pegado de la página de Universal: "23 de octubre de 2026" y, por
 * parque, "Universal Islands of Adventure", "9:00 a.m. - 8:00 p.m." y "Early Park Admission: 8:00 a.m.".
 */
export function parseUniversalHours(text: string): HoursPark[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parks: HoursPark[] = [];
  let date: string | null = null;
  let park: string | null = null;
  for (const line of lines) {
    const header = line.match(/^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/i);
    if (header) {
      const m = MONTHS.indexOf(header[2].toLowerCase());
      date = m < 0 ? null : `${header[3]}-${String(m + 1).padStart(2, "0")}-${header[1].padStart(2, "0")}`;
      park = null;
      continue;
    }
    if (!date) continue;
    if (/^Universal /i.test(line) && !/^Universal Orlando/i.test(line)) {
      park = line;
      continue;
    }
    if (!park) continue;
    const t = line.match(/^(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?\s*[-–]\s*(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?$/i);
    const early = line.match(/^Early Park Admission:\s*(\d{1,2}):(\d{2})\s*([ap])/i);
    if (!t && !early) continue;
    let entry = parks.find((p) => p.park === park);
    if (!entry) parks.push((entry = { park, days: [] }));
    let day = entry.days.find((d) => d.date === date);
    if (!day) entry.days.push((day = { date, open: null, close: null, earlyEntry: null, earlyLabel: "Early Park Admission", event: null, extended: null }));
    if (t) [day.open, day.close] = [to24(t[1], t[2], t[3]), to24(t[4], t[5], t[6])];
    if (early) day.earlyEntry = to24(early[1], early[2], early[3]).replace(/^0/, "");
  }
  return parks.map((p) => ({ ...p, days: p.days.sort((a, b) => a.date.localeCompare(b.date)) }));
}
