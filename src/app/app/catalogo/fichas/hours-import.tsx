"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, ExternalLink, X } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { dayNote, parseDisneyFiveDay, parseUniversalHours } from "@/lib/park-hours";
import { matchParkGuide, type GuideOption } from "@/lib/park-sheet";
import { applyGuideSchedules } from "./actions";

const SOURCES = {
  disney: {
    title: "Horarios de Walt Disney World",
    button: "Pegar horarios de Disney",
    destination: "DISNEY_WORLD",
    url: "https://disneyworld.disney.go.com/es-pe/calendars/five-day/#/magic-kingdom,epcot,animal-kingdom,hollywood-studios/",
    link: "calendario de 5 días de Disney",
    linkNote: "(con los 4 parques)",
    copy: "Seleccioná todo (Cmd/Ctrl + A), copiá y pegalo acá abajo.",
    parse: parseDisneyFiveDay,
  },
  universal: {
    title: "Horarios de Universal Orlando",
    button: "Pegar horarios de Universal",
    destination: "UNIVERSAL_ORLANDO",
    url: "https://www.universalorlando.com/web/es/us/plan-your-visit/hours-information/park-hours",
    link: "página de horarios de Universal",
    linkNote: "",
    copy: "Elegí un día en el calendario, copiá el recuadro con la fecha y los parques, y pegalo acá. Repetí con cada día (se van sumando).",
    parse: (text: string) => parseUniversalHours(text),
  },
} as const;
const short = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const clock = (t: string | null) => t?.replace(/^0(\d)/, "$1") ?? "…";

type Guide = Pick<GuideOption, "id" | "kind" | "name" | "park" | "aliases" | "destination">;

/** El evento de la ficha que corresponde a una noche con entrada aparte: por parque y temporada (Halloween hasta octubre, Navidad después). */
function guessEvent(events: Guide[], parkName: string | undefined, date: string) {
  const here = events.filter((g) => g.park && parkName && g.park.toLowerCase() === parkName.toLowerCase());
  const season = Number(date.slice(5, 7)) <= 10 ? /halloween|scary/i : /christmas|navidad|merry|jollywood/i;
  return here.find((g) => season.test([g.name, ...g.aliases].join(" ")))?.id ?? "";
}

/**
 * Horarios desde las páginas oficiales de Disney o Universal: el admin abre la página, copia el texto y
 * lo pega acá (no se consulta el sitio desde el servidor). Se revisa antes de guardar.
 */
export function HoursImport({ source, guides, today }: { source: keyof typeof SOURCES; guides: Guide[]; today: string }) {
  const cfg = SOURCES[source];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [parkFor, setParkFor] = useState<Record<string, string>>({});
  const [eventFor, setEventFor] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const parkGuides = guides.filter((g) => g.kind === "PARK" && g.destination === cfg.destination);
  const eventGuides = guides.filter((g) => g.kind === "EVENT" && g.destination === cfg.destination);
  const parks = useMemo(() => cfg.parse(text, today), [cfg, text, today]);
  const parkId = (name: string) => parkFor[name] ?? matchParkGuide(name, parkGuides as GuideOption[])?.id ?? "";
  const eventKey = (park: string, date: string) => `${park}|${date}`;
  const eventId = (park: string, date: string) =>
    eventFor[eventKey(park, date)] ?? guessEvent(eventGuides, parkGuides.find((g) => g.id === parkId(park))?.name, date);

  function apply() {
    const updates = new Map<string, unknown[]>();
    const push = (id: string, entry: unknown) => updates.set(id, [...(updates.get(id) ?? []), entry]);
    for (const p of parks) {
      const id = parkId(p.park);
      for (const d of p.days) {
        if (id && (d.open || d.close)) push(id, { date: d.date, openTime: d.open, closeTime: d.close, note: dayNote(d) });
        const ev = d.event && eventId(p.park, d.date);
        if (ev && d.event) push(ev, { date: d.date, openTime: d.event.open, closeTime: d.event.close, note: "" });
      }
    }
    start(async () => {
      const res = await applyGuideSchedules([...updates.entries()].map(([guideId, entries]) => ({ guideId, entries })));
      setMessage({ tone: "ok", text: `Listo: ${res.days} ${res.days === 1 ? "horario guardado" : "horarios guardados"} en ${updates.size} ${updates.size === 1 ? "ficha" : "fichas"}.` });
      setText("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary")}>
          <ClipboardPaste className="size-4" /> {cfg.button}
        </button>
        {message && <p className="text-xs text-emerald-700">{message.text}</p>}
      </div>
    );
  }

  return (
    <div className="mb-6 w-full rounded-xl border border-brand-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{cfg.title}</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-slate-600">
            <li>
              Abrí el{" "}
              <a href={cfg.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-brand-700 hover:underline">
                {cfg.link} <ExternalLink className="size-3" />
              </a>
              {cfg.linkNote && ` ${cfg.linkNote}`}.
            </li>
            <li>{cfg.copy}</li>
            <li>Revisá a qué ficha va cada parque y cada evento, y guardá.</li>
          </ol>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700" title="Cerrar">
          <X className="size-4" />
        </button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="field mt-3 font-mono text-xs" placeholder="Pegá acá el texto de la página…" />
      {message && parks.length === 0 && <p className={message.tone === "ok" ? "mt-2 text-sm text-emerald-700" : "mt-2 text-sm text-rose-700"}>{message.text}</p>}
      {text && parks.length === 0 &&<p className="mt-2 text-sm text-rose-700">No encontramos horarios en el texto. Asegurate de copiar la página en español.</p>}
      {parks.length > 0 && (
        <div className="mt-3 space-y-3">
          {parks.map((p) => (
            <div key={p.park} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-slate-900">{p.park}</span>
                <span className="text-slate-400">→</span>
                <select className="field w-auto text-sm" value={parkId(p.park)} onChange={(e) => setParkFor((s) => ({ ...s, [p.park]: e.target.value }))}>
                  <option value="">No guardar</option>
                  {parkGuides.map((g) => (
                    <option key={g.id} value={g.id}>
                      Ficha: {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <ul className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                {p.days.map((d) => (
                  <li key={d.date} className="rounded bg-slate-50 px-2 py-1.5">
                    <span className="font-semibold text-slate-800">{short(d.date)}</span>{" "}
                    <span className="text-slate-900">{d.open || d.close ? `${clock(d.open)} – ${clock(d.close)}` : "Sin horario"}</span>
                    {dayNote(d) && <span className="block text-slate-500">{dayNote(d)}</span>}
                    {d.event && (
                      <label className="mt-1 flex flex-wrap items-center gap-1 text-indigo-800">
                        Evento {clock(d.event.open)} – {clock(d.event.close)} →
                        <select
                          className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs"
                          value={eventId(p.park, d.date)}
                          onChange={(e) => setEventFor((s) => ({ ...s, [eventKey(p.park, d.date)]: e.target.value }))}
                        >
                          <option value="">No asignar</option>
                          {eventGuides.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex items-center justify-end gap-3">
            {message && <span className={message.tone === "ok" ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{message.text}</span>}
            <button type="button" onClick={apply} disabled={pending} className={buttonClass("primary")}>
              {pending ? "Guardando…" : "Guardar horarios en las fichas"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
