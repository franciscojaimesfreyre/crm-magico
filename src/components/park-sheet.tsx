import clsx from "clsx";
import {
  Castle,
  ChevronDown,
  CircleCheck,
  Clock,
  Drama,
  FerrisWheel,
  Footprints,
  IceCreamCone,
  Lightbulb,
  MapPin,
  PartyPopper,
  Smile,
  Sparkles,
  Star,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { ParkSheet, SectionKind, SheetSection } from "@/lib/park-sheet";

const SECTION_STYLE: Record<SectionKind, { icon: LucideIcon; tone: string }> = {
  MUST_DO: { icon: Star, tone: "bg-rose-100 text-rose-700" },
  CLASSICS: { icon: Castle, tone: "bg-brand-100 text-brand-800" },
  MILD: { icon: CircleCheck, tone: "bg-emerald-100 text-emerald-700" },
  SHOWS: { icon: Drama, tone: "bg-brand-50 text-brand-700" },
  CHARACTERS: { icon: Smile, tone: "bg-pink-100 text-pink-700" },
  DINING: { icon: UtensilsCrossed, tone: "bg-amber-100 text-amber-700" },
  SNACKS: { icon: IceCreamCone, tone: "bg-orange-100 text-orange-700" },
  TIPS: { icon: Lightbulb, tone: "bg-amber-100 text-amber-800" },
  AREA: { icon: MapPin, tone: "bg-sky-100 text-sky-700" },
  OTHER: { icon: Sparkles, tone: "bg-slate-100 text-slate-700" },
};

/** Secciones numeradas (ranking), como en las fichas impresas. */
const NUMBERED: SectionKind[] = ["MUST_DO", "CLASSICS"];

const hours = (s: ParkSheet) => (s.openTime && s.closeTime ? `${s.openTime} – ${s.closeTime}` : (s.openTime ?? s.closeTime ?? ""));

/**
 * La ficha plegada, para el itinerario: una barra con el parque (o el evento) y el horario del día, y un
 * botón "Ver ficha" que se nota que se toca. Adentro, la ficha completa. Es un <details>: funciona igual
 * en el servidor (portal, link público) y en el editor, y al imprimir se abre con el resto.
 */
export function CollapsibleParkSheet({ sheet, closedNote }: { sheet: ParkSheet; closedNote?: (name: string) => string | null }) {
  const event = sheet.kind === "EVENT";
  const Icon = event ? PartyPopper : FerrisWheel;
  const time = hours(sheet);
  return (
    <details data-fold className={clsx("group/sheet overflow-hidden rounded-xl bg-white ring-1", event ? "ring-amber-200" : "ring-brand-200")}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 select-none hover:bg-[var(--raised)] [&::-webkit-details-marker]:hidden">
        <span className={clsx("grid size-8 shrink-0 place-items-center rounded-full", event ? "bg-amber-100 text-amber-800" : "bg-brand-100 text-brand-700")}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{event ? `Ficha del evento · ${sheet.name}` : `Ficha de ${sheet.name}`}</span>
          <span className="block truncate text-xs text-[var(--ink-soft)]">
            {time ? `${event ? "Fiesta" : "Abre"} ${time} · ` : ""}imperdibles, shows, dónde comer y tips
          </span>
        </span>
        <span
          className={clsx(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
            event ? "bg-amber-100 text-amber-900" : "bg-brand-600 text-white",
          )}
        >
          <span className="group-open/sheet:hidden">Ver ficha</span>
          <span className="hidden group-open/sheet:inline">Ocultar</span>
          <ChevronDown className="size-3.5 transition-transform group-open/sheet:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-[var(--rule)]">
        <ParkSheetCard sheet={sheet} closedNote={closedNote} bare />
      </div>
    </details>
  );
}

/**
 * Ficha de un parque o evento especial dentro del itinerario: horarios, llegada recomendada, show
 * principal y las secciones (imperdibles, leves, shows, dónde comer, tips…). Sin hooks: la usan la
 * vista del viajero (servidor) y el editor (cliente).
 */
export function ParkSheetCard({
  sheet,
  closedNote,
  bare = false,
}: {
  sheet: ParkSheet;
  /** Dentro de la ficha plegada: sin marco propio. */
  bare?: boolean;
  /** Si una atracción o show está cerrado ese día, el texto a mostrar ("Cerrada · reabre el 31/12/2026"). */
  closedNote?: (name: string) => string | null;
}) {
  const event = sheet.kind === "EVENT";
  const facts = [
    { icon: Clock, label: event ? "Horario de la fiesta" : "Horarios", value: hours(sheet) },
    { icon: Footprints, label: "Llegada recomendada", value: sheet.arrival },
    { icon: Star, label: "Show principal", value: sheet.mainShow },
  ].filter((f) => f.value);
  const tips = sheet.sections.filter((s) => s.kind === "TIPS");
  const rest = sheet.sections.filter((s) => s.kind !== "TIPS");
  return (
    <div className={clsx(!bare && "overflow-hidden rounded-lg bg-white/90 ring-1", !bare && (event ? "ring-amber-200" : "ring-slate-200/70"))}>
      {event && (
        <p className="flex items-center gap-1.5 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950">
          <PartyPopper className="size-3.5" /> Evento especial · {sheet.name}
          {sheet.park && <span className="font-normal text-white/80">en {sheet.park}</span>}
        </p>
      )}
      <div className="p-3">
        {facts.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                <span className={clsx("grid size-7 shrink-0 place-items-center rounded-full", event ? "bg-amber-100 text-amber-800" : "bg-brand-100 text-brand-700")}>
                  <f.icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{f.label}</p>
                  <p className="text-sm leading-tight font-medium text-slate-900">{f.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {sheet.hoursNote && <p className="mt-1.5 text-[11px] text-slate-500">{sheet.hoursNote}</p>}
        {rest.length > 0 && (
          <div className={clsx("grid gap-2.5 sm:grid-cols-2", facts.length > 0 && "mt-3")}>
            {rest.map((s, i) => (
              <Section key={i} section={s} closedNote={s.kind === "DINING" || s.kind === "SNACKS" || s.kind === "CHARACTERS" ? undefined : closedNote} />
            ))}
          </div>
        )}
        {tips.map((s, i) => (
          <div key={i} className="mt-3 rounded-lg bg-amber-50/80 p-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <Lightbulb className="size-3.5" /> {s.title}
            </p>
            <ul className="mt-1.5 space-y-1">
              {s.items.map((t, j) => (
                <li key={j} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" />
                  <span>
                    {t.name}
                    {t.detail && <span className="text-slate-500"> — {t.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {s.note && <p className="mt-1.5 text-[11px] text-amber-800">{s.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ section: s, closedNote }: { section: SheetSection; closedNote?: (name: string) => string | null }) {
  const { icon: Icon, tone } = SECTION_STYLE[s.kind];
  const numbered = NUMBERED.includes(s.kind);
  return (
    <div className="rounded-lg bg-slate-50/80 p-2.5">
      <p className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <span className={clsx("grid size-6 shrink-0 place-items-center rounded-full", tone)}>
          <Icon className="size-3.5" />
        </span>
        {s.title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {s.items.map((it, i) => {
          const closed = closedNote?.(it.name) ?? null;
          return (
            <li key={i} className="flex gap-2 text-sm leading-snug">
              {numbered ? (
                <span className={clsx("grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white", closed ? "bg-slate-300" : "bg-amber-400")}>{i + 1}</span>
              ) : (
                <span className={clsx("mt-1.5 size-1.5 shrink-0 rounded-full", closed ? "bg-slate-300" : tone.split(" ")[0])} />
              )}
              <span className="min-w-0 flex-1">
                <span className={clsx("font-medium", closed ? "text-slate-500 line-through" : "text-slate-900")}>{it.name}</span>
                {it.time && !closed && <span className="ml-1.5 text-xs font-semibold text-brand-700">{it.time}</span>}
                {closed ? (
                  <span className="mt-0.5 block w-fit rounded bg-rose-50 px-1.5 py-px text-[11px] font-medium text-rose-700">{closed}</span>
                ) : (
                  it.detail && <span className="block text-xs text-slate-500">{it.detail}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {s.note && (
        <p className="mt-2 flex gap-1 rounded bg-white px-2 py-1 text-[11px] text-slate-600">
          <Lightbulb className="mt-px size-3 shrink-0 text-amber-500" /> {s.note}
        </p>
      )}
    </div>
  );
}
