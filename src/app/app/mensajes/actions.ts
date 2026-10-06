"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { loadThread } from "@/lib/messages";
import { notifyClient } from "@/lib/events";

async function ownThread(clientId: string, bookingId: string | null) {
  const user = await requireUser();
  const client = await db.client.findFirst({ where: { id: clientId, organizationId: user.organizationId } });
  if (!client) throw new Error("Cliente no encontrado");
  if (bookingId) {
    const booking = await db.booking.findFirst({ where: { id: bookingId, clientId } });
    if (!booking) throw new Error("Viaje no encontrado");
  }
  return { user, client };
}

/** Envía un mensaje del agente y devuelve el hilo actualizado. */
export async function sendAgentMessage(clientId: string, bookingId: string | null, body: string) {
  const { user } = await ownThread(clientId, bookingId);
  const text = body.trim().slice(0, 5000);
  if (text) {
    await db.message.create({
      data: { clientId, bookingId, senderType: "AGENT", senderUserId: user.id, body: text },
    });
    await notifyClient({
      organizationId: user.organizationId,
      clientId,
      title: `Nuevo mensaje de ${user.name}`,
      body: text.slice(0, 140),
      link: bookingId ? `/portal/viajes/${bookingId}?tab=mensajes` : "/portal/mensajes",
    });
  }
  return readThread(clientId, bookingId);
}

/** Devuelve el hilo y marca como leídos los mensajes del cliente. */
export async function readThread(clientId: string, bookingId: string | null) {
  await ownThread(clientId, bookingId);
  await db.message.updateMany({
    where: { clientId, bookingId, senderType: "CLIENT", readByAgentAt: null },
    data: { readByAgentAt: new Date() },
  });
  return loadThread(clientId, bookingId);
}
