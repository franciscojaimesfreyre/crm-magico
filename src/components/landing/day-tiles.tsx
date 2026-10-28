import clsx from "clsx";
import { CHARACTERS, characterSrc } from "@/lib/media";

/*
 * El muro de días del primer pantallazo: los días de un viaje caen y se apilan como piezas hasta formar
 * una pila despareja. Algunos días son de los viajeros (sus personajes), otros dicen qué día es y uno está
 * pendiente de pago. La fila de abajo es toda crema, como la sección que sigue: los días se apoyan sobre
 * ella y la pila parece crecer desde la página. Es solo CSS: sin script se ve la pila ya armada.
 */

type Tile = { kind: "day" | "mint" | "character" | "pending"; label?: string; character?: string };

// Alto de cada columna (en días) y lo que hay en algunas casillas (columna:fila desde abajo).
const HEIGHTS = [2, 3, 1, 3, 2, 1, 3, 2, 1, 2, 3, 1, 2, 3, 2, 1, 3, 2];
const SPECIAL: Record<string, Tile> = {
  "1:1": { kind: "day", label: "Día 1" },
  "1:2": { kind: "character", character: "princesa" },
  "3:2": { kind: "day", label: "Día 2" },
  "3:1": { kind: "mint" },
  "4:1": { kind: "character", character: "astronauta" },
  "6:2": { kind: "day", label: "Día 3" },
  "6:1": { kind: "pending", label: "Saldo" },
  "7:1": { kind: "mint" },
  "9:1": { kind: "character", character: "dinosaurio" },
  "10:2": { kind: "day", label: "Día 4" },
  "10:1": { kind: "character", character: "dalmata" },
  "12:1": { kind: "mint" },
  "13:2": { kind: "character", character: "leoncito" },
  "14:1": { kind: "day", label: "Día 5" },
  "16:2": { kind: "character", character: "vaquero" },
  "16:1": { kind: "day", label: "Día 6" },
  "17:1": { kind: "mint" },
};

export function DayTiles() {
  return (
    <div aria-hidden className="grid grid-cols-9 items-end gap-[3px] sm:grid-cols-18">
      {HEIGHTS.map((h, col) => (
        <div key={col} className={clsx("flex flex-col-reverse gap-[3px]", col >= 9 && "max-sm:hidden")}>
          {Array.from({ length: h }, (_, row) => {
            const t = SPECIAL[`${col}:${row}`] ?? { kind: "day" };
            const c = t.character ? CHARACTERS.find((x) => x.id === t.character) : null;
            // Cae primero la fila de abajo; dentro de cada fila, en un orden salteado como piezas.
            const delay = 350 + row * 260 + ((col * 7) % 11) * 55;
            return (
              <div
                key={row}
                style={{ "--delay": `${delay}ms`, backgroundColor: c?.color } as React.CSSProperties}
                className={clsx(
                  "relative aspect-square overflow-hidden",
                  // La fila de abajo es el piso: continua (tapa la separación entre columnas) y quieta.
                  row === 0 ? "-mr-[3px]" : "tile",
                  t.kind === "day" && "bg-[var(--ground)]",
                  t.kind === "mint" && "bg-[var(--mint)]",
                  t.kind === "pending" && "bg-amber-400",
                )}
              >
                {t.label && <span className="absolute top-3 left-3 text-[15px] font-semibold text-[var(--night)] max-lg:hidden">{t.label}</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c && <img src={characterSrc(c.id)} alt="" width={180} height={180} className="size-full object-cover" />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
