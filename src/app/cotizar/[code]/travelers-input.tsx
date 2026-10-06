"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

/** Lista dinámica de viajeros (nombre + edad) para el formulario público. */
export function TravelersInput() {
  const [rows, setRows] = useState([0, 1]);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="label mb-0">Viajeros (nombre y edad)</span>
        <button type="button" onClick={() => setRows((r) => [...r, Math.max(...r, 0) + 1])} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700">
          <Plus className="size-3.5" /> Agregar viajero
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((id) => (
          <div key={id} className="flex gap-2">
            <input name="travelerName" placeholder="Nombre y apellido" className="field" />
            <input name="travelerAge" type="number" min={0} max={110} placeholder="Edad" className="field w-24" />
            {rows.length > 1 && (
              <button type="button" onClick={() => setRows((r) => r.filter((x) => x !== id))} className="text-slate-400 hover:text-rose-600" title="Quitar">
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
