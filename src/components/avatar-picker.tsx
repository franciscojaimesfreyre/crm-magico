"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Pencil } from "lucide-react";
import { AVATAR_SET, resolveAvatar, type AvatarImageOption } from "@/lib/avatars";
import { TravelerAvatar } from "@/components/traveler-avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";

/**
 * Elegir el personaje de un viajero, al estilo de los perfiles de streaming: el personaje actual grande
 * y, al tocarlo, una grilla con todos (primero los de la agencia). Viaja en el formulario como `name`
 * ("set:castillo", "img:<id>" o vacío), igual que cualquier otro campo.
 */
export function AvatarPicker({
  name = "avatar",
  defaultValue,
  travelerName,
  images = [],
  compact = false,
}: {
  /** En una fila (por ejemplo, la lista de viajeros del portal): el personaje más chico y sin texto al lado. */
  compact?: boolean;
  name?: string;
  defaultValue?: string | null;
  travelerName: string;
  images?: AvatarImageOption[];
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const hidden = useRef<HTMLInputElement>(null);
  const current = resolveAvatar(value, images);
  const who = travelerName.trim() || "este viajero";

  // Después de guardar, el servidor manda el valor nuevo: se adopta (React resetea el formulario al terminar
  // la acción, a veces antes de que llegue, y sin esto quedaba el valor viejo en pantalla).
  const [prevDefault, setPrevDefault] = useState(defaultValue);
  if (defaultValue !== prevDefault) {
    setPrevDefault(defaultValue);
    setValue(defaultValue ?? "");
  }

  // Si el formulario se resetea (por ejemplo, después de agregar un viajero), vuelve al inicial.
  // Se lee el último valor recibido en el momento (no el de cuando se armó el listener) y un instante
  // después, porque React resetea el formulario casi junto con la llegada de los datos nuevos.
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

  const groups = [
    ...(images.length ? [{ group: "De tu agencia", items: images.map((i) => ({ value: `img:${i.id}`, label: i.name })) }] : []),
    ...AVATAR_SET.map((g) => ({ group: g.group, items: g.items.map((i) => ({ value: `set:${i.id}`, label: i.label })) })),
  ];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group flex items-center gap-3 rounded-2xl text-left" title={compact ? "Elegir personaje" : undefined}>
        <span className="relative">
          <TravelerAvatar avatar={current} name={who} size={compact ? "md" : "lg"} className="transition-transform group-hover:scale-[1.04]" />
          <span className={clsx("absolute -right-1.5 -bottom-1.5 grid place-items-center rounded-full border-2 border-white bg-brand-600 text-white shadow-sm", compact ? "size-6" : "size-7")}>
            <Pencil className={compact ? "size-3" : "size-3.5"} />
          </span>
        </span>
        <span className={clsx("text-sm", compact && "sr-only")}>
          <span className="block font-semibold text-slate-900">{current ? current.label : "Sin personaje"}</span>
          <span className="block font-medium text-brand-700 group-hover:underline">{current ? "Cambiar personaje" : "Elegir personaje"}</span>
        </span>
      </button>
      <input ref={hidden} type="hidden" name={name} value={value} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>¿Qué personaje elegís para {who}?</DialogTitle>
            <DialogDescription>Aparece en el portal del viaje y en la lista de viajeros.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.group}>
                <h3 className="mb-3 text-[11px] font-semibold tracking-[0.06em] text-[var(--ink-soft)] uppercase">{g.group}</h3>
                <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5 md:grid-cols-6">
                  {g.items.map((item) => {
                    const on = item.value === value;
                    return (
                      <li key={item.value}>
                        <button type="button" onClick={() => pick(item.value)} className="group flex w-full flex-col items-center gap-1.5 rounded-2xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-brand-500" aria-pressed={on}>
                          <span className={clsx("relative rounded-[22px] p-0.5 ring-2 transition-[box-shadow,transform] group-hover:scale-105", on ? "ring-brand-600" : "ring-transparent group-hover:ring-slate-300")}>
                            <TravelerAvatar avatar={resolveAvatar(item.value, images)} name={who} size="lg" />
                            {on && (
                              <span className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-white bg-brand-600 text-white">
                                <Check className="size-3.5" />
                              </span>
                            )}
                          </span>
                          <span className={clsx("text-center text-xs leading-tight", on ? "font-semibold text-slate-900" : "text-slate-600")}>{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {value && (
              <div className="border-t border-[var(--rule)] pt-4">
                <button type="button" onClick={() => pick("")} className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-[var(--raised)]">
                  Sin personaje (usar las iniciales)
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
