import clsx from "clsx";

/*
 * Novedades de los parques pasando en dos filas, en sentidos opuestos: lo que se carga todos los días y
 * usa la IA para armar itinerarios. Son novedades reales del catálogo. Con "reducir movimiento" quedan
 * quietas y se pueden deslizar con el dedo.
 */

const TONE = {
  Cierre: "bg-rose-600 text-white",
  Remodelación: "bg-amber-400 text-slate-900",
  Evento: "bg-[var(--mint)] text-slate-900",
  Apertura: "bg-white text-slate-900",
  Promoción: "bg-[var(--night)] text-white",
  Volvió: "bg-sky-100 text-sky-900",
} as const;

type Item = { kind: keyof typeof TONE; text: string };

const ROWS: Item[][] = [
  [
    { kind: "Cierre", text: "Volcano Bay cerrado del 26/10 al 31/3" },
    { kind: "Evento", text: "Mickey's Very Merry Christmas Party 2026" },
    { kind: "Remodelación", text: "Tiana's Bayou Adventure desde el 2/11" },
    { kind: "Apertura", text: "The Magic of Disney Animation en Hollywood Studios" },
    { kind: "Promoción", text: "4-Park Magic 2027 para Latinoamérica" },
    { kind: "Volvió", text: "Skull Island: Reign of Kong ya opera" },
  ],
  [
    { kind: "Evento", text: "EPCOT Festival of the Holidays 2026" },
    { kind: "Cierre", text: "Jurassic Park River Adventure hasta el 16/12" },
    { kind: "Apertura", text: "Fast & Furious: Hollywood Drift llega en 2027" },
    { kind: "Remodelación", text: "Carousel of Progress vuelve en 2027" },
    { kind: "Evento", text: "Primera Navidad en Epic Universe" },
    { kind: "Cierre", text: "Typhoon Lagoon: mantenimiento estacional" },
  ],
];

export function NewsTicker() {
  return (
    <div aria-label="Novedades recientes de los parques" className="mt-14 space-y-3 lg:mt-20">
      {ROWS.map((row, r) => (
        <div key={r} className="ticker overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* La fila va dos veces seguida para que el desplazamiento no tenga corte. */}
          <ul className={clsx("ticker-track flex w-max gap-3 px-[var(--gutter)]", r === 1 && "ticker-reverse")}>
            {[...row, ...row].map((it, i) => (
              <li key={i} aria-hidden={i >= row.length} className="flex shrink-0 items-center gap-3 rounded-full bg-[var(--ground)] py-2 pr-5 pl-2 text-[16px] text-[var(--night)]">
                <span className={clsx("rounded-full px-3 py-1 text-[14px] font-semibold", TONE[it.kind])}>{it.kind}</span>
                {it.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
