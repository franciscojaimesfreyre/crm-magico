"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/events";

/** Marca (o desmarca) como resuelta una fecha clave que es una acción del agente: reservó restaurantes, avisó el check-in online… */
export async function toggleKeyDateDone(bookingId: string, key: string, label: string) {
  const user = await requireUser();
  const booking = await db.booking.findFirst({ where: { id: bookingId, organizationId: user.organizationId }, select: { id: true, clientId: true } });
  if (!booking) return;
  const existing = await db.keyDateDone.findUnique({ where: { bookingId_key: { bookingId, key } } });
  if (existing) {
    await db.keyDateDone.delete({ where: { id: existing.id } });
  } else {
    await db.keyDateDone.create({ data: { bookingId, key, userId: user.id } });
    await logActivity({
      organizationId: user.organizationId,
      clientId: booking.clientId,
      bookingId,
      userId: user.id,
      type: "note",
      description: `Hecho: ${label}`,
    });
  }
  revalidatePath("/app/calendario");
  revalidatePath("/app");
  revalidatePath(`/app/viajes/${bookingId}`);
}
