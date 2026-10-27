import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { Avatar, Badge, Card } from "@/components/ui";
import { BOOKING_STATUS_COLOR, BOOKING_STATUS_LABEL, DESTINATION_LABEL, DESTINATION_TONE, urgencyTone } from "@/lib/labels";
import { daysBetween, todayUTC } from "@/lib/format";
import { computeKeyDates } from "@/lib/key-dates";
import type { LoadedBooking } from "./data";
import { bannerItem } from "@/lib/media";
import { TripBanner } from "@/components/trip-banner";

// Fechas cortas para la cabecera: "sáb 29 nov" y "29 nov" (las fechas del viaje se guardan en UTC).
const DAY = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
const clean = (s: string) => s.replace(/\./g, "").replace(",", "");

/**
 * Cabecera de un viaje en dos niveles: quién y qué (código, destino, nombre, estado, cliente) y abajo
 * los cuatro datos que se miran siempre (cuánto falta, fechas, viajeros y la próxima fecha clave).
 */
export function TripHeader({ booking: b, actions }: { booking: LoadedBooking; actions: ReactNode }) {
  const today = todayUTC();
  const tone = DESTINATION_TONE[b.destination];
  const banner = bannerItem(b.banner);
  const client = `${b.client.firstName} ${b.client.lastName}`;
  const nights = b.startDate && b.endDate ? daysBetween(b.startDate, b.endDate) : null;
  const nextKey = computeKeyDates(b).find((k) => k.date >= today);
  const nextIn = nextKey ? daysBetween(today, nextKey.date) : null;

  // Cuánto falta, o en qué parte del viaje está.
  const toStart = b.startDate ? daysBetween(today, b.startDate) : null;
  const toEnd = b.endDate ? daysBetween(today, b.endDate) : null;
  const countdown =
    toStart === null
      ? { label: "Salida", value: "Sin fecha", hint: "Cargá las fechas del viaje" }
      : toStart > 0
        ? { label: "Sale en", value: `${toStart} ${toStart === 1 ? "día" : "días"}`, hint: toStart > 60 ? `${Math.round(toStart / 30)} meses` : undefined }
        : toStart === 0
          ? { label: "Salida", value: "Hoy", hint: "¡Buen viaje!" }
          : toEnd !== null && toEnd >= 0
            ? { label: "En viaje", value: `Día ${-toStart + 1}`, hint: nights ? `de ${nights + 1}` : undefined }
            : { label: "Volvió", value: `Hace ${-(toEnd ?? toStart)} días`, hint: b.endDate ? clean(DAY.format(b.endDate)) : undefined };
  const dates = b.startDate ? (b.endDate ? `${clean(SHORT.format(b.startDate))} – ${clean(SHORT.format(b.endDate))}` : clean(SHORT.format(b.startDate))) : null;
  const years = b.startDate ? [...new Set([b.startDate, b.endDate].filter(Boolean).map((d) => d!.getUTCFullYear()))].join("/") : null;
  const soon = toStart !== null && toStart >= 0 && toStart <= 7;

  // Código, destino, estado, nombre del viaje, cliente y acciones. onImage: en blanco, sobre el banner.
  const identity = (onImage: boolean) => (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <p className={clsx("flex flex-wrap items-center gap-x-2 text-[13px]", onImage ? "text-white/85" : "text-[var(--ink-soft)]")}>
          <span className={clsx("font-mono", onImage && "font-semibold text-white")}>{b.code}</span>
          <span aria-hidden>·</span>
          <span className={clsx("inline-flex items-center gap-1.5 font-medium", onImage ? "text-white" : tone.ink)}>
            <span className={clsx("size-2 rounded-full", tone.dot)} />
            {DESTINATION_LABEL[b.destination]}
          </span>
          <Badge className={clsx("ml-1 [text-shadow:none]", BOOKING_STATUS_COLOR[b.status])}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
        </p>
        <h1 className={clsx("mt-1.5 leading-tight", onImage ? "text-[28px] text-white sm:text-[34px]" : "text-[28px] text-slate-900")}>{b.title}</h1>
        <Link href={`/app/clientes/${b.clientId}`} className={clsx("mt-2 inline-flex items-center gap-2 text-sm font-medium hover:underline", onImage ? "text-white" : "text-brand-700")}>
          <Avatar name={client} className="size-7 text-[11px] [text-shadow:none]" />
          {client}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 [text-shadow:none]">{actions}</div>
    </div>
  );

  return (
    <header className="mb-6">
      {/*
        Con banner: la imagen casi a su alto completo (4:1) y los datos del viaje por delante, sobre un
        degradé oscuro de abajo hacia arriba que garantiza que se lean con cualquier ilustración.
        Sin banner: los mismos datos sobre la hoja, como siempre.
      */}
      {banner ? (
        <TripBanner banner={b.banner} className="flex min-h-64 flex-col justify-end rounded-[20px] px-5 pt-20 pb-5 sm:px-6 lg:aspect-[4/1] lg:min-h-0">
          <Link
            href={`/app/viajes/${b.id}/editar`}
            className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900 [text-shadow:none] hover:bg-white"
          >
            Cambiar banner
          </Link>
          {identity(true)}
        </TripBanner>
      ) : (
        identity(false)
      )}

      {/* Las fechas del viaje mandan: primero y más grandes. Cuánto falta y quiénes viajan, al lado y más chicos. */}
      <Card className="mt-5 grid grid-cols-2 divide-[var(--rule)] sm:grid-cols-[2fr_1fr_1fr] sm:divide-x">
        <div className="col-span-2 min-w-0 p-5 max-sm:border-b max-sm:border-[var(--rule)] sm:col-span-1">
          <p className="text-[12px] font-semibold tracking-[0.06em] text-[var(--ink-soft)] uppercase">Fechas del viaje</p>
          <p className="figure mt-1.5 text-[28px] leading-tight text-slate-900 sm:text-[32px]">
            {dates ?? "A definir"}
            {years && <span className="text-slate-500"> {years}</span>}
          </p>
          {b.startDate && (
            <p className="mt-1 text-sm text-slate-700">
              {clean(DAY.format(b.startDate))}
              {b.endDate && <> → {clean(DAY.format(b.endDate))}</>}
              {nights !== null && <span className="text-[var(--ink-soft)]"> · {nights} {nights === 1 ? "noche" : "noches"}</span>}
            </p>
          )}
        </div>
        <Fact label={countdown.label} hint={countdown.hint}>
          <span className={clsx(soon ? "text-amber-800" : "text-slate-900")}>{countdown.value}</span>
        </Fact>
        <Fact label="Viajeros" hint={b.children > 0 ? `${b.adults} ${b.adults === 1 ? "adulto" : "adultos"}, ${b.children} ${b.children === 1 ? "menor" : "menores"}` : `${b.adults === 1 ? "Un adulto" : "Adultos"}`}>
          <span className="text-slate-900">{b.adults + b.children}</span>
        </Fact>
      </Card>

      {/* La próxima fecha clave es un recordatorio, no una fecha del viaje: va en una línea aparte, chica. */}
      {nextKey && nextIn !== null && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[13px] text-slate-700">
          <span className={clsx("size-2 shrink-0 rounded-full", nextIn <= 3 ? "bg-amber-400" : nextIn <= 7 ? "bg-brand-500" : "bg-slate-300")} />
          <span className="text-[var(--ink-soft)]">Próxima fecha clave:</span>
          <span className="font-semibold text-slate-900">{nextKey.label}</span>
          <span className="text-[var(--ink-soft)]">
            · {clean(DAY.format(nextKey.date))} · <span className={urgencyTone(nextIn).ink}>{urgencyTone(nextIn).label}</span>
          </span>
        </p>
      )}
    </header>
  );
}

function Fact({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={clsx("min-w-0 p-5", className)}>
      <p className="text-[12px] font-semibold tracking-[0.06em] text-[var(--ink-soft)] uppercase">{label}</p>
      <p className="figure mt-1.5 truncate text-[22px] leading-tight sm:text-2xl">{children}</p>
      {hint && <p className="mt-0.5 truncate text-[13px] text-[var(--ink-soft)]">{hint}</p>}
    </div>
  );
}
