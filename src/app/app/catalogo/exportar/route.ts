import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toDateInput } from "@/lib/format";
import { parseSections } from "@/lib/park-sheet";
import { CATALOG_FORMAT, type CatalogEntryExport, type ParkGuideExport } from "@/lib/catalog-io";

/** Descarga en JSON todo el catálogo de parques: lugares (atracciones, shows, restaurantes, shoppings) y fichas. */
export async function GET() {
  await requireUser();
  const [entries, guides] = await Promise.all([
    db.catalogEntry.findMany({ orderBy: [{ destination: "asc" }, { area: "asc" }, { kind: "asc" }, { name: "asc" }] }),
    db.parkGuide.findMany({ orderBy: [{ destination: "asc" }, { kind: "asc" }, { position: "asc" }, { name: "asc" }] }),
  ]);
  const exportedEntries: CatalogEntryExport[] = entries.map((e) => ({
    kind: e.kind,
    destination: e.destination,
    area: e.area,
    name: e.name,
    minHeightIn: e.minHeightIn,
    diningStyle: e.diningStyle,
    priceLevel: e.priceLevel,
    mustDo: e.mustDo,
    notes: e.notes,
    closedFrom: e.closedFrom ? toDateInput(e.closedFrom) : null,
    closedTo: e.closedTo ? toDateInput(e.closedTo) : null,
    verifiedAt: e.verifiedAt?.toISOString() ?? null,
  }));
  const exportedGuides: ParkGuideExport[] = guides.map((g) => ({
    kind: g.kind,
    destination: g.destination,
    name: g.name,
    park: g.park,
    aliases: g.aliases,
    openTime: g.openTime,
    closeTime: g.closeTime,
    hoursNote: g.hoursNote,
    arrival: g.arrival,
    mainShow: g.mainShow,
    sections: parseSections(g.sections),
    published: g.published,
    position: g.position,
  }));
  const body = JSON.stringify(
    { format: CATALOG_FORMAT, version: 1, exportedAt: new Date().toISOString(), entries: exportedEntries, guides: exportedGuides },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="catalogo-parques-${toDateInput(new Date())}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
