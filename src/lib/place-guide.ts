// Guía de un parque o de un día de crucero dentro del itinerario: atracciones, shows y experiencias
// recomendadas para esa familia, con tips prácticos. La propone la IA (lib/ai, generatePlaceGuide), el
// agente la puede recortar y el viajero la ve en el mismo lugar del itinerario donde figura el parque.
// Sin dependencias de servidor: se usa en el editor, en las vistas y en el servidor.
import { z } from "zod";
import type { ActivityType } from "@/generated/prisma/enums";

/** Tipos de actividad que llevan guía. */
export const GUIDE_TYPES: readonly ActivityType[] = ["PARK", "CRUISE"];
export const hasGuide = (type: ActivityType) => GUIDE_TYPES.includes(type);

export const GUIDE_PICK_KINDS = ["RIDE", "SHOW", "DINING", "EXPERIENCE"] as const;
export type GuidePickKind = (typeof GUIDE_PICK_KINDS)[number];

export const GUIDE_PICK_LABEL: Record<GuidePickKind, string> = {
  RIDE: "Atracción",
  SHOW: "Show",
  DINING: "Para comer",
  EXPERIENCE: "Experiencia",
};

export const PlaceGuideSchema = z.object({
  picks: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        kind: z.enum(GUIDE_PICK_KINDS).catch("EXPERIENCE"),
        why: z.string().max(400),
        // Del catálogo (no de la IA): altura mínima en pulgadas e imperdible.
        minHeightIn: z.number().int().nullable().catch(null),
        mustDo: z.boolean().catch(false),
      }),
    )
    .max(15),
  tips: z.array(z.string().min(1).max(500)).max(10),
});

export type PlaceGuide = z.infer<typeof PlaceGuideSchema>;
export type GuidePick = PlaceGuide["picks"][number];

/** La guía guardada en la base (JSON) o null si no hay o no tiene el formato esperado. */
export function parseGuide(value: unknown): PlaceGuide | null {
  if (!value) return null;
  const parsed = PlaceGuideSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data.picks.length + parsed.data.tips.length > 0 ? parsed.data : null;
}
