import clsx from "clsx";
import type { ReactNode } from "react";
import { bannerItem, bannerSrc } from "@/lib/media";

/**
 * Bloque con el banner del viaje de fondo y el contenido encima. Un degradé oscuro de abajo hacia arriba
 * garantiza que el texto blanco se lea sobre cualquier ilustración; arriba queda la imagen a la vista.
 * Sin banner, el bloque es del color del portal (var(--field)), como siempre.
 */
export function TripBanner({ banner, className, children }: { banner: string | null | undefined; className?: string; children: ReactNode }) {
  const item = bannerItem(banner);
  return (
    <section className={clsx("relative isolate overflow-hidden text-white", item ? "bg-slate-900" : "bg-[var(--field)]", className)}>
      {item && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerSrc(item.id)}
            srcSet={`${bannerSrc(item.id, "sm")} 1200w, ${bannerSrc(item.id)} 2400w`}
            sizes="(max-width: 800px) 100vw, 800px"
            alt=""
            className="absolute inset-0 -z-10 size-full object-cover"
          />
          <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/60 via-55% to-black/0" />
        </>
      )}
      {/* Con banner, una sombra mínima en el texto por si cae sobre una zona clara de la ilustración (no en los botones). */}
      <div className={clsx(item && "[text-shadow:0_1px_3px_rgb(0_0_0/0.45)] [&_a]:[text-shadow:none]")}>{children}</div>
    </section>
  );
}
