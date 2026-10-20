"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DESTINATION_LABEL } from "@/lib/labels";
import { ParkSheetSchema, SECTION_LABEL, cleanSheet, parseSchedule, todayInOrlando } from "@/lib/park-sheet";
import { DEFAULT_GUIDES } from "@/lib/park-guide-defaults";
import type { Destination } from "@/generated/prisma/enums";

/** Las fichas son de toda la plataforma: solo las editan sus administradores. */
async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) throw new Error("Solo los administradores de la plataforma editan las fichas");
  return user;
}

const GuideInputSchema = z.object({
  destination: z.enum(Object.keys(DESTINATION_LABEL) as [Destination, ...Destination[]]),
  aliases: z.array(z.string().trim().min(1).max(100)).max(20),
  published: z.boolean(),
  sheet: ParkSheetSchema,
  schedule: z.array(z.unknown()).max(400).default([]),
  /** Parque en ThemeParks.wiki del que se sincronizan los horarios (solo parques). */
  apiId: z.string().max(100).nullable().default(null),
});

export type GuideInput = z.input<typeof GuideInputSchema>;

/** Crea o actualiza una ficha base. Devuelve su id. */
export async function saveParkGuide(id: string | null, input: GuideInput) {
  await requirePlatformAdmin();
  const parsed = GuideInputSchema.safeParse(input);
  if (!parsed.success) return { error: "La ficha tiene datos inválidos." };
  const { sheet: raw, destination, aliases, published } = parsed.data;
  // Horarios por fecha: sin días pasados ni filas vacías.
  const today = todayInOrlando();
  const schedule = parseSchedule(parsed.data.schedule).filter((d) => d.date >= today && (d.openTime || d.closeTime || d.note.trim()));
  const sheet = cleanSheet(raw);
  if (!sheet.name) return { error: "Poné el nombre del parque o del evento." };
  if (sheet.kind === "EVENT" && !sheet.park?.trim()) return { error: "Indicá en qué parque se hace el evento." };
  const data = {
    kind: sheet.kind,
    destination,
    name: sheet.name,
    park: sheet.kind === "EVENT" ? sheet.park?.trim() || null : null,
    aliases,
    openTime: sheet.openTime,
    closeTime: sheet.closeTime,
    hoursNote: sheet.hoursNote || null,
    arrival: sheet.arrival || null,
    mainShow: sheet.mainShow || null,
    sections: sheet.sections,
    schedule,
    apiId: sheet.kind === "PARK" ? parsed.data.apiId || null : null,
    published,
  };
  const saved = id ? await db.parkGuide.update({ where: { id }, data }) : await db.parkGuide.create({ data });
  revalidatePath("/app/catalogo/fichas");
  return { id: saved.id };
}

export async function deleteParkGuide(id: string) {
  await requirePlatformAdmin();
  await db.parkGuide.delete({ where: { id } });
  revalidatePath("/app/catalogo/fichas");
}

/** Carga las fichas base que todavía no existen (por nombre). No toca las que ya están. */
export async function loadDefaultGuides() {
  await requirePlatformAdmin();
  const existing = new Set((await db.parkGuide.findMany({ select: { name: true } })).map((g) => g.name.toLowerCase()));
  let created = 0;
  for (const [position, g] of DEFAULT_GUIDES.entries()) {
    if (existing.has(g.name.toLowerCase())) continue;
    await db.parkGuide.create({
      data: {
        kind: g.kind,
        destination: g.destination,
        name: g.name,
        park: g.park ?? null,
        aliases: g.aliases,
        openTime: g.openTime ?? null,
        closeTime: g.closeTime ?? null,
        hoursNote: g.hoursNote ?? null,
        arrival: g.arrival ?? null,
        mainShow: g.mainShow ?? null,
        position,
        sections: g.sections.map((s) => ({
          kind: s.kind,
          title: s.title ?? SECTION_LABEL[s.kind],
          note: s.note ?? "",
          items: s.items.map(([name, detail = "", time = ""]) => ({ name, detail, time })),
        })),
      },
    });
    created++;
  }
  revalidatePath("/app/catalogo/fichas");
  return { created };
}

/**
 * Suma horarios por fecha a varias fichas a la vez (los que se leyeron del calendario de Disney).
 * Reemplaza los de esas mismas fechas y deja los demás; descarta las fechas pasadas.
 */
export async function applyGuideSchedules(updates: { guideId: string; entries: unknown[] }[]) {
  await requirePlatformAdmin();
  const today = todayInOrlando();
  let days = 0;
  for (const u of updates.slice(0, 50)) {
    const guide = await db.parkGuide.findUnique({ where: { id: u.guideId }, select: { schedule: true } });
    if (!guide) continue;
    const incoming = parseSchedule(u.entries);
    const dates = new Set(incoming.map((e) => e.date));
    const schedule = parseSchedule([...parseSchedule(guide.schedule).filter((e) => !dates.has(e.date)), ...incoming]).filter((e) => e.date >= today);
    await db.parkGuide.update({ where: { id: u.guideId }, data: { schedule } });
    days += incoming.length;
  }
  revalidatePath("/app/catalogo/fichas");
  return { days };
}
