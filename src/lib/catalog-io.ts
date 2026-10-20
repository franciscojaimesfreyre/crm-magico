// Formato JSON para exportar e importar todo el catálogo de parques: atracciones, shows, restaurantes
// y shoppings, y las fichas de parques y eventos. Sirve para pasarlo de una base a otra (por ejemplo,
// de la local a producción). Sin dependencias de servidor.
import { z } from "zod";
import { CATALOG_KIND_LABEL, DESTINATION_LABEL, DINING_STYLE_LABEL } from "@/lib/labels";
import { parseSections } from "@/lib/park-sheet";
import type { CatalogKind, Destination, DiningStyle } from "@/generated/prisma/enums";

export const CATALOG_FORMAT = "crm-magico/catalogo";

const DESTINATIONS = Object.keys(DESTINATION_LABEL) as [Destination, ...Destination[]];
const KINDS = Object.keys(CATALOG_KIND_LABEL) as [CatalogKind, ...CatalogKind[]];
const DINING = Object.keys(DINING_STYLE_LABEL) as [DiningStyle, ...DiningStyle[]];
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullish()
  .transform((v) => v ?? null);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const time = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .nullish()
  .transform((v) => v ?? null);

export const CatalogEntryExportSchema = z.object({
  kind: z.enum(KINDS),
  destination: z.enum(DESTINATIONS),
  area: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(300),
  minHeightIn: z.number().int().positive().nullish().transform((v) => v ?? null),
  diningStyle: z.enum(DINING).nullish().catch(null).transform((v) => v ?? null),
  priceLevel: z.number().int().min(1).max(4).nullish().catch(null).transform((v) => v ?? null),
  mustDo: z.boolean().default(false),
  notes: text(2000),
  closedFrom: day,
  closedTo: day,
  /** Última revisión contra la fuente oficial (ISO). */
  verifiedAt: z.string().datetime().nullish().catch(null).transform((v) => v ?? null),
});

export const ParkGuideExportSchema = z.object({
  kind: z.enum(["PARK", "EVENT"]),
  destination: z.enum(DESTINATIONS),
  name: z.string().trim().min(1).max(200),
  park: text(200),
  aliases: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  openTime: time,
  closeTime: time,
  hoursNote: text(300),
  arrival: text(200),
  mainShow: text(200),
  sections: z.unknown().transform((v) => parseSections(v)),
  published: z.boolean().default(true),
  position: z.number().int().default(0),
});

export type CatalogEntryExport = z.input<typeof CatalogEntryExportSchema>;
export type ParkGuideExport = z.input<typeof ParkGuideExportSchema>;

export const CatalogFileSchema = z.object({
  format: z.string().optional(),
  entries: z.array(z.unknown()).max(5000).default([]),
  guides: z.array(z.unknown()).max(500).default([]),
});
