"use client";

import { useState } from "react";

/**
 * Comisión como porcentaje del importe o como monto fijo en la moneda del viaje.
 * Envía commissionMode ("percent" | "fixed") y commissionValue.
 */
export function CommissionInput({
  rate,
  fixed,
  defaultRate,
  currency,
}: {
  rate?: string | null;
  fixed?: string | null;
  defaultRate: number;
  currency: string;
}) {
  const [mode, setMode] = useState<"percent" | "fixed">(fixed ? "fixed" : "percent");
  const initial = mode === "fixed" ? fixed : rate;
  return (
    <label className="block">
      <span className="label">Comisión</span>
      <div className="flex">
        <input
          type="number"
          step="0.01"
          min={0}
          max={mode === "percent" ? 100 : undefined}
          name="commissionValue"
          defaultValue={initial ?? ""}
          key={mode}
          placeholder={mode === "percent" ? String(defaultRate) : undefined}
          required={mode === "fixed"}
          className="field min-w-0"
          style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
        />
        <select
          name="commissionMode"
          value={mode}
          onChange={(e) => setMode(e.target.value as "percent" | "fixed")}
          className="field"
          style={{ width: "auto", borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0, background: "#f8fafc" }}
          aria-label="Tipo de comisión"
        >
          <option value="percent">%</option>
          <option value="fixed">{currency}</option>
        </select>
      </div>
      <span className="mt-1 block text-xs text-slate-400">
        {mode === "percent" ? `Porcentaje del importe. Vacío = ${defaultRate}%` : `Monto fijo en ${currency}`}
      </span>
    </label>
  );
}
