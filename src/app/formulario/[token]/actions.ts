"use server";

import { db } from "@/lib/db";
import { logActivity, notifyStaff } from "@/lib/events";
import { formLinkExpired, parseAnswers } from "@/lib/form-answers";
import type { FormField } from "@/lib/forms";
import type { ActionState } from "@/components/form-controls";

/** Respuesta a un pedido personal: llega asociada al cliente y al viaje. */
export async function submitFormRequest(token: string, _: ActionState, formData: FormData): Promise<ActionState> {
  if (String(formData.get("website") ?? "")) return { ok: "¡Gracias!" };
  const request = await db.formRequest.findUnique({ where: { token }, include: { form: true, client: true, booking: { select: { code: true, agentId: true } } } });
  if (!request) return { error: "Este link ya no es válido." };
  if (formLinkExpired(request.sentAt) && request.status !== "ANSWERED") return { error: "Este link venció: pedile uno nuevo a tu agente." };
  if (request.status === "ANSWERED") return { ok: "¡Ya lo habías respondido!" };
  const fields = request.form.fields as FormField[];
  const parsed = parseAnswers(fields, formData);
  if ("error" in parsed) return parsed;
  // Los viajeros precargados tienen que ser de este cliente.
  const own = new Set((await db.traveler.findMany({ where: { clientId: request.clientId }, select: { id: true } })).map((t) => t.id));
  for (const v of Object.values(parsed.data)) if (Array.isArray(v)) for (const row of v) if (row.travelerId && !own.has(row.travelerId)) delete row.travelerId;

  const sub = await db.formSubmission.create({
    data: { formId: request.formId, data: parsed.data, clientId: request.clientId, bookingId: request.bookingId, requestId: request.id },
  });
  await db.formRequest.update({ where: { id: request.id }, data: { status: "ANSWERED", answeredAt: new Date() } });
  const who = `${request.client.firstName} ${request.client.lastName}`.trim();
  await notifyStaff({
    organizationId: request.organizationId,
    userId: request.booking?.agentId ?? request.client.ownerId ?? null,
    title: `${who} respondió "${request.form.title}"${request.booking ? ` (${request.booking.code})` : ""}`,
    body: "Revisalo y pasalo a la ficha.",
    link: `/app/formularios/${request.formId}?tab=respuestas#r-${sub.id}`,
  });
  await logActivity({ organizationId: request.organizationId, clientId: request.clientId, bookingId: request.bookingId, type: "form", description: `Respondió "${request.form.title}"` });
  return { ok: "¡Gracias! Recibimos tus respuestas." };
}

/** "Abierto" lo marca el navegador del cliente (no la vista previa de WhatsApp o Gmail, que no corre scripts). */
export async function markFormOpened(token: string) {
  await db.formRequest.updateMany({ where: { token, status: "SENT" }, data: { status: "OPENED", openedAt: new Date() } });
}
