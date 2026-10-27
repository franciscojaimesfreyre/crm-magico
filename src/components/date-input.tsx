"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import { es } from "react-day-picker/locale";
import { Calendar } from "@/components/shadcn/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/popover";

/** "2026-11-29" → fecha local (el calendario trabaja en hora local; el valor viaja como texto). */
function parse(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const LABEL = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Campo de fecha con el calendario de la app en lugar del nativo del navegador. Manda lo mismo que un
 * <input type="date">: "aaaa-mm-dd" (o vacío) con su name, así las acciones del servidor no cambian.
 * Sin `value` funciona como un input no controlado (defaultValue, y vuelve a él si el formulario se resetea).
 */
export function DateInput({
  name,
  defaultValue,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  placeholder = "Elegí una fecha",
  className,
  id,
  title,
  size = "md",
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  title?: string;
  size?: "sm" | "md";
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const hidden = useRef<HTMLInputElement>(null);
  const current = value ?? inner;
  const selected = parse(current);
  const minDate = parse(min);
  const maxDate = parse(max);

  // Después de guardar, el servidor manda el valor nuevo: se adopta (React resetea el formulario al terminar
  // la acción, a veces antes de que llegue, y sin esto quedaba el valor viejo en pantalla).
  const [prevDefault, setPrevDefault] = useState(defaultValue);
  if (defaultValue !== prevDefault) {
    setPrevDefault(defaultValue);
    setInner(defaultValue ?? "");
  }

  // Como un input nativo: si el formulario se resetea, vuelve al valor inicial.
  // Se lee el último valor recibido en el momento (no el de cuando se armó el listener) y un instante
  // después, porque React resetea el formulario casi junto con la llegada de los datos nuevos.
  const latestDefault = useRef(defaultValue);
  useLayoutEffect(() => {
    latestDefault.current = defaultValue;
  }, [defaultValue]);
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const reset = () => setTimeout(() => setInner(latestDefault.current ?? ""), 0);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  // Avisa al formulario como lo haría un input nativo (hay pantallas que escuchan "change" en el form).
  const changed = useRef(false);
  useEffect(() => {
    if (!changed.current) return;
    changed.current = false;
    hidden.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [current]);

  const set = (next: string) => {
    changed.current = true;
    if (value === undefined) setInner(next);
    onChange?.(next);
    setOpen(false);
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayAllowed =
    (!minDate || today >= minDate) && (!maxDate || today <= maxDate);

  return (
    <div className={clsx("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          title={title}
          disabled={disabled}
          className={clsx(
            "field flex items-center gap-2 text-left",
            size === "sm" && "min-h-0 py-1 text-xs",
            !selected && "text-[#5c6b67]",
          )}
        >
          <CalendarDays
            className={clsx(
              "shrink-0",
              size === "sm" ? "size-3.5" : "size-4",
              selected ? "text-brand-600" : "text-slate-500",
            )}
          />
          <span className="truncate">
            {selected ? LABEL.format(selected).replace(/\./g, "") : placeholder}
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Calendar
            mode="single"
            locale={es}
            selected={selected}
            defaultMonth={selected ?? minDate ?? today}
            onSelect={(d) => d && set(toValue(d))}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            captionLayout="dropdown"
            startMonth={new Date(1920, 0)}
            endMonth={new Date(now.getFullYear() + 10, 11)}
          />
          {(todayAllowed || (!required && current)) && (
            <div className="flex items-center justify-between gap-2 border-t border-[var(--rule)] px-1 pt-2">
              {todayAllowed ? (
                <button
                  type="button"
                  onClick={() => set(toValue(today))}
                  className="rounded-full px-3 py-1 text-[13px] font-semibold text-brand-700 hover:bg-brand-50"
                >
                  Hoy
                </button>
              ) : (
                <span />
              )}
              {!required && current && (
                <button
                  type="button"
                  onClick={() => set("")}
                  className="rounded-full px-3 py-1 text-[13px] font-medium text-slate-600 hover:bg-[var(--raised)]"
                >
                  Borrar
                </button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {/* Después del botón: un <label> que envuelve el campo abre el calendario. Es el valor que viaja con el formulario; invisible, pero participa de la validación (required). */}
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
