"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { SelectField } from "@/components/select-field";

/**
 * Cambiar el estado de un viaje: se aplica al elegirlo (sin botón aparte). La acción recibe el estado
 * nuevo; mientras se guarda se ve un indicador al lado.
 */
export function StatusSelect({
  action,
  value,
  options,
}: {
  action: (status: string) => Promise<void>;
  value: string;
  options: readonly { value: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <SelectField
        key={value}
        defaultValue={value}
        options={options}
        className="w-44"
        aria-label="Estado del viaje"
        onValueChange={(next) => next && next !== value && startTransition(() => action(next))}
      />
      {pending && <Loader2 className="size-4 animate-spin text-[var(--ink-soft)]" aria-label="Guardando" />}
    </div>
  );
}
