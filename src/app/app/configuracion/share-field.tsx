"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui";

/**
 * Tu parte de la comisión del proveedor (lo que la agencia te transfiere). Con un ejemplo en vivo, para que
 * no se confunda con la comisión que pagan los proveedores sobre la venta.
 */
export function AgentShareField({ defaultValue, providerRate }: { defaultValue: string; providerRate: number }) {
  const [value, setValue] = useState(defaultValue);
  const share = value.trim() === "" ? 100 : Math.min(100, Math.max(0, Number(value.replace(",", ".")) || 0));
  const provider = (1000 * providerRate) / 100;
  const mine = (provider * share) / 100;
  const fmt = (n: number) => `US$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
  return (
    <div>
      <Field label="Tu parte de la comisión (%)" hint="Lo que la agencia te transfiere de la comisión que pagan los proveedores. Vacío = 100 % (no retiene nada).">
        <Input name="agentSharePercent" type="number" step="0.01" min={0} max={100} value={value} onChange={(e) => setValue(e.target.value)} placeholder="100" />
      </Field>
      <p className="mt-1 text-xs text-slate-700">
        Ej.: venta US$ 1.000 → proveedor {fmt(provider)} → {share < 100 ? `la agencia retiene ${100 - share} % → ` : ""}vos {fmt(mine)}
      </p>
    </div>
  );
}
