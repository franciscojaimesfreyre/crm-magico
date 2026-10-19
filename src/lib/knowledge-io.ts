// Formato JSON para exportar e importar novedades (pasarlas de una base a otra, compartirlas o
// cargarlas en bloque). Sin dependencias de servidor.
import { z } from "zod";
import { DESTINATION_LABEL, KNOWLEDGE_CATEGORY_LABEL } from "@/lib/labels";
import type { Destination, KnowledgeCategory } from "@/generated/prisma/enums";

export const KNOWLEDGE_FORMAT = "crm-magico/novedades";

const CATEGORIES = Object.keys(KNOWLEDGE_CATEGORY_LABEL) as [KnowledgeCategory, ...KnowledgeCategory[]];
const DESTINATIONS = Object.keys(DESTINATION_LABEL) as [Destination, ...Destination[]];
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha YYYY-MM-DD")
  .nullish()
  .transform((v) => v ?? null);

export const KnowledgeExportItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.string().trim().min(1).max(20000),
  category: z.enum(CATEGORIES).catch("NEWS"),
  destinations: z.array(z.enum(DESTINATIONS)).default([]),
  park: z.string().trim().max(200).nullish().transform((v) => v || null),
  tags: z.array(z.string().trim().max(60)).max(30).default([]),
  validFrom: day,
  validTo: day,
  sourceUrl: z.string().trim().max(1000).nullish().transform((v) => (v && /^https?:\/\//.test(v) ? v : null)),
  published: z.boolean().default(true),
  pinned: z.boolean().default(false),
  /** global: de la plataforma (solo la importa así un admin general); agencia: de la agencia que importa. */
  scope: z.enum(["global", "agencia"]).default("agencia"),
});

export type KnowledgeExportItem = z.infer<typeof KnowledgeExportItemSchema>;

/** Acepta el archivo exportado ({ format, items }) o directamente una lista de novedades. */
export const KnowledgeFileSchema = z.union([
  z.object({ format: z.string().optional(), items: z.array(z.unknown()).max(1000) }),
  z.array(z.unknown()).max(1000).transform((items) => ({ format: undefined, items })),
]);
