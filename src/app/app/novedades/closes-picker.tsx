"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban } from "lucide-react";
import { entriesNamedIn } from "@/lib/itinerary-checks";

type Entry = { id: string; name: string; area: string };

const CLOSING = ["CLOSURE", "REFURBISHMENT"];

/**
 * Atracciones del catálogo que cierra una novedad de cierre o remodelación, durante su vigencia.
 * Por defecto se detectan del título (en vivo); se pueden elegir a mano. Envía closesManual y closesEntryIds.
 */
export function ClosesPicker({ entries, initialIds, initialManual }: { entries: Entry[]; initialIds: string[]; initialManual: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [manual, setManual] = useState(initialManual);
  const [picked, setPicked] = useState<string[]>(initialIds);
  const [query, setQuery] = useState("");

  // Lee el título y la categoría del formulario mientras se escriben.
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const read = () => {
      setTitle(form.querySelector<HTMLInputElement>('[name="title"]')?.value ?? "");
      setCategory(form.querySelector<HTMLSelectElement>('[name="category"]')?.value ?? "");
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, []);

  const detected = useMemo(() => entriesNamedIn(title, entries), [title, entries]);
  const chosen = manual ? entries.filter((e) => picked.includes(e.id)) : detected;
  const matches = query.trim().length >= 2 ? entries.filter((e) => `${e.name} ${e.area}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];

  return (
    <div ref={ref} className="sm:col-span-2">
      {CLOSING.includes(category) && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
            <Ban className="size-4 text-rose-600" /> Atracciones que cierra
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Durante la vigencia de la novedad se ven tachadas como cerradas en las fichas de los itinerarios, la revisión automática las marca y la IA no las propone.
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={!manual} onChange={() => setManual(false)} /> Detectarlas del título
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={manual}
                onChange={() => {
                  setManual(true);
                  if (picked.length === 0) setPicked(detected.map((e) => e.id));
                }}
              />{" "}
              Elegirlas a mano
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chosen.length === 0 && <span className="text-xs text-slate-500">{manual ? "Ninguna elegida: no cierra atracciones del catálogo." : "El título no nombra ninguna atracción del catálogo."}</span>}
            {chosen.map((e) => (
              <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-slate-800 ring-1 ring-rose-200">
                {e.name} <span className="text-slate-400">· {e.area}</span>
                {manual && (
                  <button type="button" onClick={() => setPicked((p) => p.filter((id) => id !== e.id))} className="ml-0.5 text-slate-400 hover:text-rose-600" title="Quitar">
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {manual && (
            <div className="relative mt-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar una atracción o show del catálogo…" className="field text-sm" />
              {matches.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {matches.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked((p) => (p.includes(e.id) ? p : [...p, e.id]));
                          setQuery("");
                        }}
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-brand-50"
                      >
                        {e.name} <span className="text-xs text-slate-400">· {e.area}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {manual && <input type="hidden" name="closesManual" value="1" />}
      {manual && picked.map((id) => <input key={id} type="hidden" name="closesEntryIds" value={id} />)}
    </div>
  );
}
