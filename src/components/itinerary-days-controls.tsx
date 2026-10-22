"use client";

import { useEffect, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

/**
 * Abrir o cerrar todos los días de un itinerario de solo lectura (los <details data-day> dentro de
 * `containerId`). Al imprimir se abre todo (días y fichas), para que el papel tenga el itinerario completo.
 */
export function ItineraryDaysControls({ containerId }: { containerId: string }) {
  const [allOpen, setAllOpen] = useState(false);
  const days = () => Array.from(document.querySelectorAll<HTMLDetailsElement>(`#${containerId} details[data-day]`));

  useEffect(() => {
    // En papel va todo abierto: los días y las fichas de los parques.
    const open = () => document.querySelectorAll<HTMLDetailsElement>(`#${containerId} details[data-day], #${containerId} details[data-fold]`).forEach((d) => (d.open = true));
    window.addEventListener("beforeprint", open);
    return () => window.removeEventListener("beforeprint", open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  const toggle = () => {
    const next = !allOpen;
    days().forEach((d) => (d.open = next));
    setAllOpen(next);
  };

  return (
    <button type="button" onClick={toggle} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-50 print:hidden">
      {allOpen ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
      {allOpen ? "Cerrar todos los días" : "Abrir todos los días"}
    </button>
  );
}
