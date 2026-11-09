"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export type Feature = { title: string; text: string; image: string; alt: string };

/**
 * Las funciones de Yiorno en un bloque que queda fijo mientras se baja: a la izquierda la lista se abre de
 * a una, a la derecha cambia la captura de la app. En el teléfono (y sin script) es una lista común, cada
 * función con su captura. Debajo de la lista, una barra y un contador muestran cuánto falta del recorrido
 * (mientras el bloque está fijo, el scroll cambia la captura y no parece avanzar); en la última, una flecha
 * lleva a la sección siguiente. Los títulos funcionan como pestañas.
 */
export function FeaturePin({ features }: { features: Feature[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (window.innerWidth < 1024) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const progress = Math.min(0.999, Math.max(0, -r.top / span));
      setActive(Math.floor(progress * features.length));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [features.length]);

  // Tocar una función lleva el scroll hasta su tramo, así la lista también se maneja con clics.
  const go = (i: number) => {
    const el = box.current;
    if (!el || window.innerWidth < 1024) return;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: el.offsetTop + (span * (i + 0.5)) / features.length, behavior: "smooth" });
  };

  // La flecha lleva justo después del bloque, a la sección que sigue.
  const next = () => {
    const el = box.current;
    if (el) window.scrollTo({ top: el.offsetTop + el.offsetHeight, behavior: "smooth" });
  };

  return (
    <div ref={box} className="lg:h-[calc(var(--n)*30svh+100svh)]" style={{ "--n": features.length } as React.CSSProperties}>
      <div className="lg:sticky lg:top-0 lg:flex lg:h-svh lg:items-center">
        <div className="grid w-full gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <ol>
            {features.map((f, i) => {
              const on = active === i;
              return (
                <li key={f.title} className="border-t border-[var(--ground)]/20 last:border-b">
                  <button type="button" onClick={() => go(i)} className="press w-full py-5 text-left max-lg:pointer-events-none lg:py-6" aria-expanded={on}>
                    <span className={clsx("block text-[length:var(--t-h3)] leading-tight font-semibold transition-colors", on ? "text-[var(--ground)]" : "text-[var(--ground)] lg:text-[var(--ground)]/45")}>
                      {f.title}
                    </span>
                  </button>
                  <div className={clsx("grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", on ? "grid-rows-[1fr]" : "max-lg:grid-rows-[1fr] lg:grid-rows-[0fr]")}>
                    <div className="overflow-hidden">
                      <p className="max-w-[46ch] pb-6 text-[var(--ground)]/85">{f.text}</p>
                      {/* En el teléfono, cada función lleva su captura debajo. */}
                      <div className="mb-8 rounded-[20px] bg-[var(--ground)] p-2 lg:hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.image} alt={f.alt} width={1600} height={1000} loading="lazy" className="w-full rounded-[14px]" />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
            </ol>
            {/* Cuánto falta del recorrido y la flecha que invita a seguir bajando. Solo con el bloque fijo. */}
            <div className="mt-8 hidden h-10 items-center gap-5 lg:flex">
              <div className="flex gap-1.5" aria-hidden>
                {features.map((f, i) => (
                  <span
                    key={f.title}
                    className={clsx("h-1.5 rounded-full transition-all duration-500", i === active ? "w-10 bg-[var(--mint)]" : i < active ? "w-5 bg-[var(--mint)]/60" : "w-5 bg-[var(--ground)]/20")}
                  />
                ))}
              </div>
              <p className="text-[15px] font-semibold text-[var(--ground)]/80 tabular-nums" aria-live="polite">
                {active + 1} de {features.length}
              </p>
              {active === features.length - 1 && (
                <button
                  type="button"
                  onClick={next}
                  className="press ml-auto inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[15px] font-semibold text-[var(--ground)]/80 hover:bg-[var(--ground)]/10 hover:text-[var(--ground)]"
                >
                  Ver lo que sigue
                  <svg aria-hidden viewBox="0 0 16 16" className="nudge size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {/* Las capturas van en un marco crema (el fondo de la app): así el menú Verde noche de la app no se funde con el de la sección. */}
          <div className="hidden rounded-[28px] bg-[var(--ground)] p-3 lg:col-span-7 lg:block">
          <div className="relative aspect-[1600/1000] overflow-hidden rounded-[18px]">
            {features.map((f, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f.image}
                src={f.image}
                alt={i === active ? f.alt : ""}
                width={1600}
                height={1000}
                loading="lazy"
                className={clsx("shot absolute inset-0 size-full object-cover object-left-top", i === active ? "opacity-100" : "translate-y-4 opacity-0")}
              />
            ))}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
