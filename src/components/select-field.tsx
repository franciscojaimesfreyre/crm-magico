"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { SelectContent, SelectGroup, SelectItem, SelectLabel } from "@/components/shadcn/select";

type Option = { value: string; label: string };

/**
 * Select con el menú de la app (Base UI vía shadcn) en lugar del nativo. Manda lo mismo que un <select>:
 * el valor elegido con su name, "" para el placeholder. Sin `value` es no controlado (defaultValue; si no
 * hay, el placeholder o la primera opción, como el nativo) y vuelve al inicial si el formulario se resetea.
 */
export function SelectField({
  options,
  groups,
  placeholder,
  name,
  defaultValue,
  value,
  onValueChange,
  required,
  disabled,
  className,
  triggerClassName,
  id,
  size = "md",
  "aria-label": ariaLabel,
}: {
  options?: readonly Option[];
  groups?: readonly { label: string; options: readonly Option[] }[];
  placeholder?: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Clases extra para el botón (por ejemplo, para pegarlo a otro campo). */
  triggerClassName?: string;
  id?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  const all = [...(options ?? []), ...(groups ?? []).flatMap((g) => g.options)];
  const initial = defaultValue ?? (placeholder !== undefined ? "" : (all[0]?.value ?? ""));
  const [inner, setInner] = useState(initial);
  const current = value ?? inner;
  const hidden = useRef<HTMLInputElement>(null);
  const changed = useRef(false);
  const label = current === "" && placeholder !== undefined ? placeholder : (all.find((o) => o.value === current)?.label ?? placeholder ?? "");

  // Después de guardar, el servidor manda el valor nuevo: se adopta (React resetea el formulario al terminar
  // la acción, a veces antes de que llegue, y sin esto quedaba el valor viejo en pantalla).
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setInner(initial);
  }

  // Se lee el último valor recibido en el momento (no el de cuando se armó el listener) y un instante
  // después, porque React resetea el formulario casi junto con la llegada de los datos nuevos.
  const latestInitial = useRef(initial);
  useLayoutEffect(() => {
    latestInitial.current = initial;
  }, [initial]);
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const reset = () => setTimeout(() => setInner(latestInitial.current), 0);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  // Avisa al formulario como lo haría un select nativo (hay pantallas que escuchan "change" en el form).
  useEffect(() => {
    if (!changed.current) return;
    changed.current = false;
    hidden.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [current]);

  const set = (next: unknown) => {
    const v = typeof next === "string" ? next : "";
    changed.current = true;
    if (value === undefined) setInner(v);
    onValueChange?.(v);
  };

  return (
    <div className={clsx("relative", className)}>
      <SelectPrimitive.Root value={current} onValueChange={set} disabled={disabled}>
        <SelectPrimitive.Trigger
          id={id}
          aria-label={ariaLabel}
          className={clsx(
            "field flex items-center justify-between gap-2 text-left data-popup-open:border-brand-500 data-popup-open:ring-3 data-popup-open:ring-brand-100",
            size === "sm" && "min-h-0 py-1 text-xs",
            current === "" && placeholder !== undefined && "text-[#5c6b67]",
            triggerClassName,
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 shrink-0 text-slate-500" />
        </SelectPrimitive.Trigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {placeholder !== undefined && <SelectItem value="">{placeholder}</SelectItem>}
          {options?.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
          {groups?.map((g) => (
            <SelectGroup key={g.label}>
              <SelectLabel>{g.label}</SelectLabel>
              {g.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </SelectPrimitive.Root>
      {/* Después del botón: un <label> que envuelve el campo abre el menú. Es el valor que viaja con el formulario. */}
      <input
        ref={hidden}
        name={name}
        value={current}
        required={required}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </div>
  );
}
