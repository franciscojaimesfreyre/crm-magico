import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { Avatar, Badge } from "@/components/ui";
import CountUp from "@/components/CountUp";

/**
 * Un viaje con forma de ticket: el talón (código y cuenta regresiva) separado por la perforación del
 * cuerpo (cliente, destino, fechas, estado y la próxima fecha clave). Es la pieza propia del producto:
 * aparece en el inicio, en el tablero de viajes y en la cabecera de cada viaje.
 */
export function TripTicket({
  href,
  code,
  title,
  client,
  destination,
  dates,
  status,
  daysToGo,
  next,
  size = "md",
  cut,
  animate = false,
  titleAs = "p",
  clientHref,
  tone,
  className,
}: {
  href?: string;
  code: string;
  title: string;
  client: string;
  destination: string;
  dates: string;
  status?: { label: string; className: string };
  /** Días hasta la salida (null si no tiene fechas; negativo si ya salió). */
  daysToGo: number | null;
  /** La próxima fecha clave del viaje, en una línea. */
  next?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Color de lo que hay detrás del ticket (para las muescas). */
  cut?: string;
  /** La cuenta regresiva cuenta al cargar (solo en el ticket destacado del inicio). */
  animate?: boolean;
  /** En la cabecera de un viaje, el título es el h1 de la pantalla. */
  titleAs?: "p" | "h1";
  /** Vínculo al cliente (solo cuando el ticket entero no es un vínculo). */
  clientHref?: string;
  /** Color del destino (ver DESTINATION_TONE): tiñe el talón, la cuenta regresiva y el punto del destino. */
  tone?: { dot: string; soft: string; ink: string };
  className?: string;
}) {
  const Title = titleAs;
  const large = size === "lg";
  const small = size === "sm";
  const countdown =
    daysToGo === null ? null : daysToGo < 0 ? { n: null, label: "En viaje" } : daysToGo === 0 ? { n: null, label: "Sale hoy" } : { n: daysToGo, label: daysToGo === 1 ? "día" : "días" };
  const body = (
    <>
      <div className={clsx("ticket-stub flex flex-col items-center justify-center rounded-l-[19px] text-center", tone?.soft, large ? "w-24 px-2 py-5 sm:w-36 sm:px-4 sm:py-6" : small ? "w-20 px-2 py-3" : "w-24 px-2 py-4 sm:w-28 sm:px-3")}>
        {countdown?.n != null ? (
          <>
            <span className={clsx("figure leading-none", tone?.ink ?? "text-slate-900", large ? "text-5xl sm:text-6xl" : small ? "text-3xl" : "text-4xl sm:text-[40px]")}>
              {animate ? <CountUp to={countdown.n} duration={1.4} trigger="load" /> : countdown.n}
            </span>
            <span className={clsx("mt-1 font-medium", tone?.ink ?? "text-slate-600", small ? "text-xs" : "text-sm")}>{countdown.label}</span>
          </>
        ) : (
          <span className={clsx("figure leading-tight", tone?.ink ?? "text-slate-900", small ? "text-base" : "text-xl")}>{countdown?.label ?? "Sin fecha"}</span>
        )}
        <span className={clsx("font-mono text-slate-500", small ? "mt-1 text-[11px]" : "mt-3 text-xs")}>{code}</span>
      </div>
      <div className={clsx("min-w-0", large ? "p-4 sm:p-6" : small ? "px-4 py-3" : "p-4")}>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <Title className={clsx("leading-tight font-bold tracking-[-0.02em] text-slate-900", large ? "text-xl sm:text-[28px]" : small ? "text-base" : "text-lg")}>{title}</Title>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-[var(--ink-soft)]">
              {tone && <span className={clsx("size-2 shrink-0 rounded-full", tone.dot)} />}
              {destination}
            </p>
          </div>
          {status && <Badge className={status.className}>{status.label}</Badge>}
        </div>
        <div className={clsx("flex flex-wrap items-center gap-x-3 gap-y-1", small ? "mt-2" : "mt-4")}>
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={client} className={small ? "size-6 text-[11px]" : "size-7"} />
            {clientHref && !href ? (
              <Link href={clientHref} className="truncate text-sm font-medium text-brand-700 hover:underline">
                {client}
              </Link>
            ) : (
              <span className="truncate text-sm text-slate-800">{client}</span>
            )}
          </span>
          <span className="text-sm text-[var(--ink-soft)] tabular-nums">{dates}</span>
        </div>
        {next && <div className={clsx("text-[13px] text-slate-700", small ? "mt-2" : "mt-3 border-t border-[var(--rule)] pt-3")}>{next}</div>}
      </div>
    </>
  );
  const cls = clsx("ticket", href && "t-lift hover:border-brand-300", className);
  const style = cut ? ({ "--ticket-cut": cut } as React.CSSProperties) : undefined;
  return href ? (
    <Link href={href} className={cls} style={style}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}
