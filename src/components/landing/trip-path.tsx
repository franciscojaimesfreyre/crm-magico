"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * El camino del viaje: una cinta Verde Yiorno que serpentea por detrás de las estaciones (de la consulta al
 * viaje) y se va dibujando a medida que se baja. El trazado se calcula con la posición real de cada
 * estación ([data-stop]); sin script, las estaciones se ven igual, sin la cinta.
 */
export function TripPath({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const [geo, setGeo] = useState<{ w: number; h: number; d: string } | null>(null);

  // Trazado: de arriba al centro, y de ahí de un costado al otro pasando por cada estación.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const build = () => {
      const r = el.getBoundingClientRect();
      const w = r.width;
      const narrow = w < 768;
      const stops = Array.from(el.querySelectorAll<HTMLElement>("[data-stop]")).map((s, i) => {
        const b = s.getBoundingClientRect();
        const side = i % 2 === 0 ? (narrow ? 0.06 : 0.1) : narrow ? 0.94 : 0.9;
        return { x: w * side, y: b.top - r.top + b.height / 2 };
      });
      if (!stops.length) return;
      let d = `M ${w / 2} 0`;
      let prev = { x: w / 2, y: 0 };
      for (const p of [...stops, { x: w / 2, y: r.height }]) {
        const dy = (p.y - prev.y) * 0.55;
        d += ` C ${prev.x} ${prev.y + dy}, ${p.x} ${p.y - dy}, ${p.x} ${p.y}`;
        prev = p;
      }
      setGeo({ w, h: r.height, d });
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // El dibujo sigue al scroll: la cinta llega un poco por delante de la mitad de la pantalla.
  useEffect(() => {
    const el = box.current;
    const p = path.current;
    if (!el || !p || !geo) return;
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      p.style.strokeDashoffset = "0";
      return;
    }
    let raf = 0;
    const draw = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.65 - r.top) / r.height));
      p.style.strokeDashoffset = `${len * (1 - progress)}`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [geo]);

  return (
    <div ref={box} className="relative">
      {geo && (
        <svg aria-hidden width={geo.w} height={geo.h} className="pointer-events-none absolute inset-0 overflow-visible">
          <path ref={path} d={geo.d} fill="none" stroke="var(--color-brand-600)" strokeWidth={geo.w < 768 ? 22 : 54} strokeLinecap="round" style={{ strokeDasharray: 1e5, strokeDashoffset: 1e5 }} />
        </svg>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
