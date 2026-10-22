// Datos de ThemeParks.wiki en las fichas: el crédito que piden sus condiciones de uso y los precios de
// Lightning Lane de un día.
import clsx from "clsx";
import type { ScheduleEntry } from "@/lib/park-sheet";

export function ThemeParksCredit({ className }: { className?: string }) {
  return (
    <a href="https://www.themeparks.wiki/" target="_blank" rel="noreferrer" className={clsx("text-xs text-slate-500 hover:text-slate-600 hover:underline", className)}>
      Powered by ThemeParks.wiki
    </a>
  );
}

const PASSES = /^Lightning Lane (Multi|Premier) Pass$/;

/** Precios de Lightning Lane del día: Multi Pass y Premier Pass a la vista, cada atracción al desplegar. */
export function LightningLanePrices({ entry }: { entry: ScheduleEntry }) {
  const all = entry.lightningLane ?? [];
  if (all.length === 0) return null;
  const passes = all.filter((p) => PASSES.test(p.name));
  const singles = all.filter((p) => !PASSES.test(p.name));
  const summary = [...passes.map((p) => `${p.name.replace("Lightning Lane ", "")} ${p.price}`), singles.length > 0 && `${singles.length} con Single Pass`].filter(Boolean).join(" · ");
  return (
    <details className="text-xs text-slate-500">
      <summary className="cursor-pointer select-none hover:text-slate-700">Lightning Lane: {summary}</summary>
      <ul className="mt-1 space-y-0.5 pl-4">
        {all.map((p) => (
          <li key={p.name} className={clsx(!p.available && "text-slate-500 line-through")} title={p.available ? undefined : "Agotado al sincronizar"}>
            {p.name.replace(/^Lightning Lane for /, "")}: {p.price}
          </li>
        ))}
      </ul>
    </details>
  );
}
