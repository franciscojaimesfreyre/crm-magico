"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ImageIcon } from "lucide-react";
import { BANNERS, bannerItem, bannerSrc } from "@/lib/media";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";

/**
 * Elegir el banner de un viaje: la vista previa como la ve el cliente (con el título encima) y, al tocarla,
 * una grilla con todos. Viaja en el formulario como `banner` (el id o vacío).
 */
export function BannerPicker({ defaultValue, title }: { defaultValue?: string | null; title?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const hidden = useRef<HTMLInputElement>(null);
  const current = bannerItem(value);

  // Después de guardar se adopta lo que manda el servidor (ver DateInput: React resetea el formulario).
  const [prevDefault, setPrevDefault] = useState(defaultValue);
  if (defaultValue !== prevDefault) {
    setPrevDefault(defaultValue);
    setValue(defaultValue ?? "");
  }
  const latestDefault = useRef(defaultValue);
  useLayoutEffect(() => {
    latestDefault.current = defaultValue;
  }, [defaultValue]);
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const reset = () => setTimeout(() => setValue(latestDefault.current ?? ""), 0);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  const pick = (next: string) => {
    setValue(next);
    setOpen(false);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative isolate block aspect-[4/1] w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--raised)] text-left"
      >
        {current ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bannerSrc(current.id, "sm")} alt="" className="absolute inset-0 -z-10 size-full object-cover transition-transform group-hover:scale-[1.02]" />
            <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-black/0" />
            <span className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3 text-white">
              <span className="truncate text-lg font-bold">{title || "Tu viaje"}</span>
              <span className="shrink-0 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">Cambiar banner</span>
            </span>
          </>
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-sm text-[var(--ink-soft)] group-hover:text-slate-900">
            <ImageIcon className="size-5" />
            <span className="font-semibold text-brand-700">Elegir un banner</span>
          </span>
        )}
      </button>
      <input ref={hidden} type="hidden" name="banner" value={value} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Elegí el banner del viaje</DialogTitle>
            <DialogDescription>Se ve arriba en el portal del cliente, detrás del nombre del viaje.</DialogDescription>
          </DialogHeader>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {BANNERS.map((b) => {
              const on = b.id === value;
              return (
                <li key={b.id}>
                  <button type="button" onClick={() => pick(b.id)} aria-pressed={on} className="group block w-full rounded-2xl text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-brand-500">
                    <span className={clsx("relative block aspect-[4/1] overflow-hidden rounded-2xl ring-2 transition-shadow", on ? "ring-brand-600" : "ring-transparent group-hover:ring-slate-300")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bannerSrc(b.id, "sm")} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-[1.03]" />
                      {on && (
                        <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full border-2 border-white bg-brand-600 text-white">
                          <Check className="size-3.5" />
                        </span>
                      )}
                    </span>
                    <span className={clsx("mt-1.5 block text-sm", on ? "font-semibold text-slate-900" : "text-slate-600")}>{b.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {value && (
            <div className="border-t border-[var(--rule)] pt-4">
              <button type="button" onClick={() => pick("")} className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-[var(--raised)]">
                Sin banner (usar el color del portal)
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
