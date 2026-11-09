import clsx from "clsx";
import { CHARACTERS, characterSrc } from "@/lib/media";

/*
 * El camino de los días del primer pantallazo: una cinta menta que serpentea de punta a punta y se dibuja al
 * cargar, con una línea punteada que avanza por el centro como un recorrido. Sobre ella aparecen, en orden,
 * las fechas clave (el saldo, los pases rápidos, el día que se viaja), el primer día en el parque y los personajes de los viajeros, que después flotan apenas. Abajo,
 * el borde ondulado da paso al crema de la sección siguiente. Es todo CSS: sin script se ve el camino armado.
 */

/** Una parada del camino: x es la posición en el ancho (0 a 100) y mx la del teléfono, si se muestra ahí. */
type Stop = { x: number; mx?: number; kind: "pending" | "fastpass" | "trip" | "day" | "character"; label?: string; note?: string; character?: string };

// En orden, como pasan las cosas: el saldo, la reserva de pases rápidos, el día que se viaja y el primer día en el parque.
const STOPS: Stop[] = [
  { x: 5, mx: 6, kind: "character", character: "princesa" },
  { x: 16, kind: "pending", label: "Saldo del paquete", note: "vence en 30 días" },
  { x: 27, kind: "character", character: "astronauta" },
  { x: 38.5, mx: 38, kind: "fastpass", label: "Pases rápidos", note: "se reservan 7 días antes" },
  { x: 50, kind: "character", character: "dinosaurio" },
  { x: 61.5, mx: 77, kind: "trip", label: "¡Día de viaje!", note: "todo listo" },
  { x: 73, kind: "character", character: "dalmata" },
  { x: 84, kind: "day", label: "Día 1", note: "primer parque" },
  { x: 95, kind: "character", character: "vaquero" },
];

/** Color de cada tipo de parada: el saldo pendiente en amarillo, los pases en verde noche, el viaje en menta. */
const CHIP: Record<Exclude<Stop["kind"], "character">, string> = {
  pending: "bg-amber-400 text-[var(--night)]",
  fastpass: "bg-[var(--night)] text-[var(--ground)]",
  trip: "bg-[var(--mint)] text-[var(--night)]",
  day: "bg-[var(--ground)] text-[var(--night)]",
};

/** Altura de la cinta (0 a 100) en cada punto del ancho: una onda y media, centrada en la franja. */
const waveY = (x: number) => 52 + 26 * Math.sin((x / 100) * Math.PI * 3 + 0.4);

const PATH = Array.from({ length: 101 }, (_, i) => `${i === 0 ? "M" : "L"} ${i} ${waveY(i).toFixed(2)}`).join(" ");

export function HeroTrail() {
  return (
    <div aria-hidden>
      <div className="relative mx-[var(--gutter)] h-[180px] sm:h-[230px] lg:h-[250px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trail-line absolute inset-0 size-full overflow-visible">
          <path d={PATH} fill="none" stroke="var(--mint)" strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.35} />
          <path d={PATH} fill="none" stroke="var(--ground)" strokeWidth={3} strokeDasharray="2 14" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="trail-dash" />
        </svg>
        {STOPS.map((s, i) => {
          const c = s.character ? CHARACTERS.find((x) => x.id === s.character) : null;
          const tilt = i % 2 === 0 ? -5 : 5;
          return (
            <div
              key={s.x}
              style={
                {
                  "--x": `${s.x}%`,
                  "--y": `${waveY(s.x)}%`,
                  "--mx": `${s.mx ?? s.x}%`,
                  "--my": `${waveY(s.mx ?? s.x)}%`,
                  "--delay": `${450 + s.x * 14}ms`,
                } as React.CSSProperties
              }
              className={clsx(
                "trail-stop absolute top-[var(--y)] left-[var(--x)] -translate-x-1/2 -translate-y-1/2 max-sm:top-[var(--my)] max-sm:left-[var(--mx)]",
                s.mx === undefined && "max-sm:hidden",
              )}
            >
              {c ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={characterSrc(c.id)}
                  alt=""
                  width={112}
                  height={112}
                  style={{ backgroundColor: c.color, rotate: `${tilt}deg`, "--r": `${tilt}deg`, animationDelay: `${-i * 700}ms` } as React.CSSProperties}
                  className="bob block size-16 max-w-none rounded-[20px] border-4 border-[var(--ground)] sm:size-24 lg:size-28 lg:rounded-[24px]"
                />
              ) : (
                <span
                  style={{ rotate: `${tilt / 2}deg` }}
                  className={clsx(
                    "block rounded-[14px] px-3.5 py-2 text-[15px] font-semibold whitespace-nowrap sm:rounded-[16px] sm:px-5 sm:py-2.5 sm:text-base",
                    CHIP[s.kind as keyof typeof CHIP],
                  )}
                >
                  {s.label}
                  {s.note && <span className="block text-[13px] leading-tight font-medium opacity-75 sm:text-sm">{s.note}</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Borde ondulado: el crema de la sección siguiente sube a recibir el camino. */}
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none" className="-mb-px block h-12 w-full sm:h-20">
        <path d="M0 50 C 220 10, 420 90, 720 46 S 1180 8, 1440 52 V 90 H 0 Z" fill="var(--ground)" />
      </svg>
    </div>
  );
}
