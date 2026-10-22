"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, "0"));

/**
 * Campo de hora de la app: muestra "09:30" y abre dos columnas, horas y minutos (de a 5). Manda lo mismo
 * que un <input type="time">: "HH:MM" (o vacío). Controlado con `value`/`onChange` o, en formularios del
 * servidor, con `name`/`defaultValue`.
 */
export function TimeInput({
  name,
  value,
  defaultValue,
  onChange,
  id,
  placeholder = "--:--",
  className,
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const current = value !== undefined ? (value ?? "") : inner;
  const [hh, mm] = /^\d{2}:\d{2}$/.test(current) ? current.split(":") : ["", ""];
  const hoursList = useRef<HTMLDivElement>(null);
  const minutesList = useRef<HTMLDivElement>(null);

  // Al abrir, la hora y los minutos elegidos quedan a la vista.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      // Sin hora todavía, arranca en la mañana (casi nada pasa a medianoche).
      (hoursList.current?.querySelector("[data-on=true]") ?? hoursList.current?.querySelector('[data-hour="09"]'))?.scrollIntoView({ block: "center" });
      minutesList.current?.querySelector("[data-on=true]")?.scrollIntoView({ block: "center" });
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  const set = (next: string) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
  };
  // Si los minutos no son múltiplo de 5 (cargados a mano antes), se suman a la lista.
  const minutes = mm && !MINUTES.includes(mm) ? [...MINUTES, mm].sort() : MINUTES;
  const cell = (on: boolean) =>
    clsx("w-full rounded-lg px-3 py-1.5 text-center text-sm tabular-nums", on ? "bg-brand-600 font-semibold text-white" : "text-slate-700 hover:bg-brand-50");

  return (
    <div className={clsx("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger id={id} aria-label={ariaLabel} className={clsx("field flex items-center gap-2 text-left tabular-nums", !current && "text-[#6e6b66]")}>
          <Clock className={clsx("size-4 shrink-0", current ? "text-brand-600" : "text-slate-500")} />
          <span>{current || placeholder}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-2">
          <div className="grid grid-cols-2 gap-1 text-[11px] font-semibold tracking-[0.06em] text-[var(--ink-soft)] uppercase">
            <span className="text-center">Hora</span>
            <span className="text-center">Min</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div ref={hoursList} className="max-h-56 space-y-0.5 overflow-y-auto pr-0.5">
              {HOURS.map((h) => (
                <button key={h} type="button" data-on={h === hh} data-hour={h} className={cell(h === hh)} onClick={() => set(`${h}:${mm || "00"}`)}>
                  {h}
                </button>
              ))}
            </div>
            <div ref={minutesList} className="max-h-56 space-y-0.5 overflow-y-auto pr-0.5">
              {minutes.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-on={m === mm}
                  className={cell(m === mm)}
                  onClick={() => {
                    set(`${hh || "09"}:${m}`);
                    setOpen(false);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {current && (
            <div className="border-t border-[var(--rule)] pt-2">
              <button
                type="button"
                onClick={() => {
                  set("");
                  setOpen(false);
                }}
                className="w-full rounded-full px-3 py-1 text-[13px] font-medium text-slate-600 hover:bg-[var(--raised)]"
              >
                Borrar
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
}
