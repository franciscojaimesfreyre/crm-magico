"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AIError, generateItinerary } from "@/lib/ai";
import { logActivity, notifyClient } from "@/lib/events";
import { ACTIVITY_TYPE_LABEL } from "@/lib/labels";
import type { ActivityType } from "@/generated/prisma/enums";

const ACTIVITY_TYPES = Object.keys(ACTIVITY_TYPE_LABEL) as [ActivityType, ...ActivityType[]];
const time = z.string().regex(/^\d{2}:\d{2}$/).nullable();

const DaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  title: z.string().max(200).nullable(),
  notes: z.string().max(5000).nullable(),
  items: z
    .array(
      z.object({
        type: z.enum(ACTIVITY_TYPES),
        title: z.string().min(1).max(300),
        startTime: time,
        endTime: time,
        location: z.string().max(300).nullable(),
        notes: z.string().max(5000).nullable(),
        confirmationNumber: z.string().max(100).nullable(),
      }),
    )
    .max(80),
});

export type ItineraryDayInput = z.infer<typeof DaySchema>;
export type ItineraryTarget = { kind: "booking" | "group"; id: string };

async function checkTarget(target: ItineraryTarget) {
  const user = await requireUser();
  if (target.kind === "booking") {
    const booking = await db.booking.findFirst({ where: { id: target.id, organizationId: user.organizationId } });
    if (!booking) throw new Error("Viaje no encontrado");
    return { user, booking, group: null };
  }
  const group = await db.group.findFirst({ where: { id: target.id, organizationId: user.organizationId } });
  if (!group) throw new Error("Grupo no encontrado");
  return { user, booking: null, group };
}

/** Reemplaza el itinerario completo (el editor manda todo el estado). */
export async function saveItinerary(target: ItineraryTarget, days: ItineraryDayInput[], notifyTraveler: boolean) {
  const parsed = z.array(DaySchema).max(60).safeParse(days);
  if (!parsed.success) return { error: "El itinerario tiene datos inválidos: revisá horarios (HH:MM) y títulos." };
  const { user, booking, group } = await checkTarget(target);
  const where = target.kind === "booking" ? { bookingId: target.id } : { groupId: target.id };

  await db.$transaction(async (tx) => {
    await tx.itineraryDay.deleteMany({ where });
    for (const [idx, d] of parsed.data.entries()) {
      await tx.itineraryDay.create({
        data: {
          ...where,
          dayNumber: idx + 1,
          date: d.date ? new Date(`${d.date}T00:00:00.000Z`) : null,
          title: d.title,
          notes: d.notes,
          items: { create: d.items.map((i, pos) => ({ ...i, position: pos })) },
        },
      });
    }
  });

  if (booking) {
    await logActivity({ organizationId: user.organizationId, clientId: booking.clientId, bookingId: booking.id, userId: user.id, type: "itinerary", description: "Itinerario actualizado" });
    if (notifyTraveler) {
      await notifyClient({
        organizationId: user.organizationId,
        clientId: booking.clientId,
        title: "Tu itinerario fue actualizado",
        body: booking.title,
        link: `/portal/viajes/${booking.id}?tab=itinerario`,
      });
    }
    revalidatePath(`/app/viajes/${booking.id}`);
  }
  if (group && notifyTraveler) {
    const members = await db.booking.findMany({ where: { groupId: group.id }, select: { clientId: true, id: true } });
    for (const m of members) {
      await notifyClient({
        organizationId: user.organizationId,
        clientId: m.clientId,
        title: "El itinerario del grupo fue actualizado",
        body: group.name,
        link: `/portal/viajes/${m.id}?tab=itinerario`,
      });
    }
    revalidatePath(`/app/grupos/${group.id}`);
  }
  return { ok: true as const };
}

/** Propuesta de la IA. No guarda nada: el editor la carga para que el agente la revise. */
export async function proposeItinerary(bookingId: string, instructions: string) {
  const user = await requireUser();
  try {
    const result = await generateItinerary({ bookingId, organizationId: user.organizationId, instructions });
    const used = await db.knowledgeItem.findMany({
      where: { id: { in: result.knowledgeUsed } },
      select: { id: true, title: true },
    });
    return { result, knowledgeUsed: used };
  } catch (e) {
    if (e instanceof AIError) return { error: e.message };
    console.error("Error generando itinerario", e);
    return { error: "No se pudo generar el itinerario. Revisá la configuración de la IA e intentá de nuevo." };
  }
}
