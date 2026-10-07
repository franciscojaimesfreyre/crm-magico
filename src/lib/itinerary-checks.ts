// Revisión automática de un itinerario contra el catálogo de parques: a qué atracciones no llega cada
// viajero, qué está cerrado ese día, qué atracciones no existen en el catálogo y qué imperdibles faltan.
// Lo calcula el sistema (no la IA), así que vale igual para una propuesta de la IA o para lo que
// arma el agente a mano. Función pura: se usa en el editor (cliente).

export type CheckEntry = {
  id: string;
  kind: "ATTRACTION" | "SHOW";
  area: string;
  name: string;
  minHeightIn: number | null;
  mustDo: boolean;
  closedFrom: string | null; // YYYY-MM-DD
  closedTo: string | null;
  notes: string | null;
};

export type CheckTraveler = { name: string; heightCm: number | null; age: number | null };

type Item = { type: string; title: string; location: string | null };
type Day = { date: string | null; title: string | null; items: Item[] };

export type ItemWarning = { tone: "error" | "warn"; text: string };

/** Altura mínima en cm, redondeada hacia arriba (igual que en el servidor). */
export const minHeightCm = (inches: number) => Math.ceil(inches * 2.54);

export function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "") // "Peter Pan's Flight" ≈ "Peter Pan"
    .replace(/['’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|starring|la|el)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lugar del catálogo al que se refiere una actividad. Matchea si el título contiene el nombre del
 * catálogo (o al revés, para nombres largos como "Expedition Everest – Legend of the Forbidden
 * Mountain"); gana el nombre más largo.
 */
export function matchEntry(item: Item, entries: CheckEntry[]) {
  const title = normalize(item.title.replace(/\([^)]*\)/g, " ")); // "(Lightning Lane)", "(reserva)"…
  if (title.length < 4) return null;
  let best: CheckEntry | null = null;
  let bestLen = 0;
  for (const e of entries) {
    const name = normalize(e.name);
    if (name.length < 4) continue;
    // Partes de nombres compuestos: "Star Wars: Rise of the Resistance", "Expedition Everest – Legend…".
    const parts = e.name.split(/\s[–-]\s|:\s/).map(normalize).filter((x) => x.length >= 8 && x !== name);
    const hit =
      ` ${title} `.includes(` ${name} `) ||
      (title.length >= 8 && ` ${name} `.includes(` ${title} `)) ||
      parts.some((x) => ` ${title} `.includes(` ${x} `));
    if (hit && name.length > bestLen) {
      best = e;
      bestLen = name.length;
    }
  }
  return best;
}

function closedOn(e: CheckEntry, date: string | null) {
  if (!e.closedFrom || !date) return false;
  return e.closedFrom <= date && (!e.closedTo || e.closedTo >= date);
}

/** Parque de cada día: el que más actividades del catálogo tiene, o el que nombra el título del día. */
function dayAreas(days: Day[], entries: CheckEntry[]) {
  const areas = [...new Set(entries.map((e) => e.area))];
  return days.map((d) => {
    const votes = new Map<string, number>();
    for (const i of d.items) {
      const e = matchEntry(i, entries);
      if (e) votes.set(e.area, (votes.get(e.area) ?? 0) + 1);
    }
    const title = normalize(d.title ?? "");
    for (const a of areas) if (title && ` ${title} `.includes(` ${normalize(a)} `)) votes.set(a, (votes.get(a) ?? 0) + 2);
    return [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  });
}

export function checkItinerary(days: Day[], entries: CheckEntry[], travelers: CheckTraveler[]) {
  const itemWarnings = days.map((d) =>
    d.items.map((item): ItemWarning[] => {
      const out: ItemWarning[] = [];
      const e = matchEntry(item, entries);
      if (!e) {
        if (item.type === "RIDE" && entries.length > 0) out.push({ tone: "warn", text: "No figura en el catálogo: verificá que exista y esté abierta." });
        return out;
      }
      if (closedOn(e, d.date)) {
        out.push({ tone: "error", text: `Cerrada ese día${e.closedTo ? ` (reabre el ${e.closedTo})` : " (sin fecha de reapertura confirmada)"}.` });
      }
      if (e.minHeightIn) {
        const min = minHeightCm(e.minHeightIn);
        const short = travelers.filter((t) => t.heightCm && t.heightCm < min);
        if (short.length) {
          out.push({
            tone: "error",
            text: `${short.map((t) => `${t.name} (${t.heightCm} cm)`).join(" y ")} no ${short.length > 1 ? "llegan" : "llega"} a la altura mínima de ${min} cm. Usar rider switch.`,
          });
        }
        const unknown = travelers.filter((t) => !t.heightCm && t.age !== null && t.age < 14);
        if (unknown.length) out.push({ tone: "warn", text: `Altura mínima ${min} cm: falta la altura de ${unknown.map((t) => t.name).join(" y ")}.` });
      }
      return out;
    }),
  );

  // Imperdibles que faltan en los parques que se visitan.
  const areasByDay = dayAreas(days, entries);
  const present = new Set(days.flatMap((d) => d.items.map((i) => matchEntry(i, entries)?.id).filter(Boolean)));
  const missing: { entry: CheckEntry; dayIndex: number }[] = [];
  const visited = new Set<string>();
  areasByDay.forEach((areas, di) => {
    const main = areas[0];
    if (!main || visited.has(main)) return;
    visited.add(main);
    for (const e of entries) {
      if (e.area === main && e.mustDo && !present.has(e.id) && !closedOn(e, days[di].date)) missing.push({ entry: e, dayIndex: di });
    }
  });

  const count = itemWarnings.flat(2).length;
  return { itemWarnings, missing, count };
}

/** Agrega los imperdibles que faltan al día de su parque (al final del día). */
export function withMustDos<D extends Day>(days: D[], entries: CheckEntry[], make: (e: CheckEntry) => D["items"][number]) {
  const { missing } = checkItinerary(days, entries, []);
  if (missing.length === 0) return { days, added: [] as CheckEntry[] };
  const next = days.map((d, di) => {
    const add = missing.filter((m) => m.dayIndex === di).map((m) => make(m.entry));
    return add.length ? { ...d, items: [...d.items, ...add] } : d;
  });
  return { days: next, added: missing.map((m) => m.entry) };
}
