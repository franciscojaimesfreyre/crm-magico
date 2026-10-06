import "server-only";
import { db } from "@/lib/db";

/** Registra una entrada en la línea de tiempo del cliente / reserva. */
export async function logActivity(input: {
  organizationId: string;
  type: string;
  description: string;
  clientId?: string | null;
  bookingId?: string | null;
  userId?: string | null;
}) {
  await db.activity.create({ data: input });
}

/** Notificación para un agente (userId) o para todo el equipo (userId null). */
export async function notifyStaff(input: {
  organizationId: string;
  title: string;
  body?: string;
  link?: string;
  userId?: string | null;
}) {
  await db.notification.create({ data: input });
}

/** Notificación para el cliente en su portal (si tiene cuenta). */
export async function notifyClient(input: {
  organizationId: string;
  clientId: string;
  title: string;
  body?: string;
  link?: string;
}) {
  const account = await db.clientAccount.findUnique({ where: { clientId: input.clientId } });
  if (!account) return;
  await db.notification.create({
    data: {
      organizationId: input.organizationId,
      clientAccountId: account.id,
      title: input.title,
      body: input.body,
      link: input.link,
    },
  });
}
