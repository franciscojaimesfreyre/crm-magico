"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import { logActivity, notifyClient } from "@/lib/events";
import type { ActionState } from "@/components/form-controls";
import type { Destination, GroupStatus } from "@/generated/prisma/enums";

function fields(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  return {
    name: str("name") ?? "",
    description: str("description"),
    destination: (str("destination") as Destination | null) ?? null,
    startDate: parseDateInput(formData.get("startDate")),
    endDate: parseDateInput(formData.get("endDate")),
    status: (str("status") ?? "PLANNING") as GroupStatus,
    organizerId: str("organizerId"),
    notes: str("notes"),
  };
}

async function ownGroup(id: string) {
  const user = await requireUser();
  const group = await db.group.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!group) throw new Error("Grupo no encontrado");
  return { user, group };
}

export async function createGroup(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const data = fields(formData);
  if (!data.name) return { error: "Poné un nombre al grupo" };
  const group = await db.group.create({ data: { ...data, organizationId: user.organizationId } });
  redirect(`/app/grupos/${group.id}`);
}

export async function updateGroup(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await ownGroup(id);
  const data = fields(formData);
  if (!data.name) return { error: "Poné un nombre al grupo" };
  await db.group.update({ where: { id }, data });
  revalidatePath(`/app/grupos/${id}`);
  return { ok: "Grupo actualizado" };
}

export async function deleteGroup(id: string) {
  await ownGroup(id);
  await db.group.delete({ where: { id } });
  redirect("/app/grupos");
}

export async function linkBooking(groupId: string, formData: FormData) {
  const { user } = await ownGroup(groupId);
  const bookingId = String(formData.get("bookingId") ?? "");
  await db.booking.updateMany({ where: { id: bookingId, organizationId: user.organizationId }, data: { groupId } });
  revalidatePath(`/app/grupos/${groupId}`);
}

export async function unlinkBooking(groupId: string, bookingId: string) {
  const { user } = await ownGroup(groupId);
  await db.booking.updateMany({ where: { id: bookingId, groupId, organizationId: user.organizationId }, data: { groupId: null } });
  revalidatePath(`/app/grupos/${groupId}`);
}

/** Envía el mismo mensaje a la conversación de cada reserva del grupo. */
export async function broadcastToGroup(groupId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, group } = await ownGroup(groupId);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Escribí el mensaje" };
  const bookings = await db.booking.findMany({ where: { groupId, status: { not: "CANCELLED" } } });
  for (const b of bookings) {
    await db.message.create({
      data: { clientId: b.clientId, bookingId: b.id, senderType: "AGENT", senderUserId: user.id, body: `[${group.name}] ${body}` },
    });
    await notifyClient({
      organizationId: user.organizationId,
      clientId: b.clientId,
      title: `Mensaje para el grupo ${group.name}`,
      body: body.slice(0, 140),
      link: `/portal/viajes/${b.id}?tab=mensajes`,
    });
    await logActivity({ organizationId: user.organizationId, clientId: b.clientId, bookingId: b.id, userId: user.id, type: "message", description: "Mensaje grupal enviado" });
  }
  return { ok: `Mensaje enviado a ${bookings.length} viaje${bookings.length === 1 ? "" : "s"}` };
}
