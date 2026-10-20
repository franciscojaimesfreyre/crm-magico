import "server-only";
import { db } from "@/lib/db";

/** Atracciones y shows del catálogo, para elegir cuáles cierra una novedad. */
export function catalogOptions() {
  return db.catalogEntry.findMany({
    where: { kind: { in: ["ATTRACTION", "SHOW"] } },
    select: { id: true, name: true, area: true },
    orderBy: [{ area: "asc" }, { name: "asc" }],
  });
}
