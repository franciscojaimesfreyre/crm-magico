"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Entrada de las partes de una sección (los [data-reveal] adentro), una sola vez al aparecer. Sin script
 * todo se ve: el estado oculto solo existe cuando este componente ya montó (clase reveal-ready).
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    // Lo que ya está a la vista se marca antes de ocultar nada, para que no parpadee.
    for (const el of items) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) el.classList.add("is-in");
      else io.observe(el);
    }
    root.classList.add("reveal-ready");
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
