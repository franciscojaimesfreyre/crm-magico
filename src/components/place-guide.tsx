import clsx from "clsx";
import { Drama, Lightbulb, RollerCoaster, Ruler, Sparkles, Star, UtensilsCrossed, X, type LucideIcon } from "lucide-react";
import { GUIDE_PICK_LABEL, type GuidePickKind, type PlaceGuide } from "@/lib/place-guide";
import { minHeightCm } from "@/lib/itinerary-checks";

const KIND_ICON: Record<GuidePickKind, LucideIcon> = {
  RIDE: RollerCoaster,
  SHOW: Drama,
  DINING: UtensilsCrossed,
  EXPERIENCE: Sparkles,
};

const KIND_TONE: Record<GuidePickKind, string> = {
  RIDE: "bg-rose-100 text-rose-700",
  SHOW: "bg-fuchsia-100 text-fuchsia-700",
  DINING: "bg-amber-100 text-amber-700",
  EXPERIENCE: "bg-sky-100 text-sky-700",
};

/**
 * Recomendaciones y tips de un parque o día de crucero, dentro del itinerario. Sin hooks: la usan la
 * vista del viajero (servidor) y el editor (cliente), que además pasa los handlers para recortarla.
 */
export function PlaceGuideCard({
  guide,
  cruise = false,
  onRemovePick,
  onRemoveTip,
  pickNotes,
}: {
  guide: PlaceGuide;
  cruise?: boolean;
  onRemovePick?: (index: number) => void;
  onRemoveTip?: (index: number) => void;
  /** Avisos del editor por recomendación (por ejemplo, quién no llega a la altura). */
  pickNotes?: (string | null)[];
}) {
  return (
    <div className="rounded-xl bg-white/90 p-3 ring-1 ring-slate-200/70">
      {guide.picks.length > 0 && (
        <>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand-700 uppercase">
            <Sparkles className="size-3.5" /> {cruise ? "Para disfrutar a bordo" : "Lo que les recomendamos"}
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {guide.picks.map((p, i) => {
              const Icon = KIND_ICON[p.kind];
              return (
                <li key={`${p.name}-${i}`} className="group/pick relative flex gap-2.5 rounded-lg bg-slate-50/80 p-2.5">
                  <span className={clsx("grid size-8 shrink-0 place-items-center rounded-full", KIND_TONE[p.kind])} title={GUIDE_PICK_LABEL[p.kind]}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="pr-5 text-sm leading-snug font-semibold text-slate-900">
                      {p.name}
                      {p.mustDo && (
                        <span className="ml-1.5 inline-flex translate-y-[-1px] items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px align-middle text-[10px] font-semibold text-amber-800">
                          <Star className="size-2.5 fill-amber-500 text-amber-500" /> Imperdible
                        </span>
                      )}
                    </p>
                    {p.why && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{p.why}</p>}
                    {p.minHeightIn && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <Ruler className="size-3" /> Altura mínima {minHeightCm(p.minHeightIn)} cm
                      </p>
                    )}
                    {pickNotes?.[i] && <p className="mt-1 text-[11px] text-rose-700">{pickNotes[i]}</p>}
                  </div>
                  {onRemovePick && (
                    <button
                      type="button"
                      onClick={() => onRemovePick(i)}
                      className="absolute top-1.5 right-1.5 text-slate-300 hover:text-rose-600"
                      title="Quitar recomendación"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {guide.tips.length > 0 && (
        <div className={clsx("rounded-lg bg-amber-50/80 p-2.5", guide.picks.length > 0 && "mt-3")}>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-800 uppercase">
            <Lightbulb className="size-3.5" /> Tips
          </p>
          <ul className="mt-1.5 space-y-1">
            {guide.tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" />
                <span className="flex-1">{t}</span>
                {onRemoveTip && (
                  <button type="button" onClick={() => onRemoveTip(i)} className="text-slate-300 hover:text-rose-600" title="Quitar tip">
                    <X className="size-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
