"use client";

import { useState } from "react";
import { SelectField } from "@/components/select-field";

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
        <SelectField
          name="commissionMode"
          value={mode}
          onValueChange={(v) => setMode(v as "percent" | "fixed")}
          className="w-24 shrink-0"
          triggerClassName="rounded-l-none border-l-0 bg-[var(--raised)]"
          aria-label="Tipo de comisión"
          options={[
            { value: "percent", label: "%" },
            { value: "fixed", label: currency },
          ]}
        />
      </div>
      <span className="mt-1 block text-xs text-slate-500">
        {mode === "percent" ? `Porcentaje del importe. Vacío = ${defaultRate}%` : `Monto fijo en ${currency}`}
      </span>
    </label>
  );
}
