"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { shortCode } from "@/lib/crypto";
import { uniqueInviteCode } from "@/lib/invite";
import { FORM_TEMPLATES, FIELD_TYPES, type Answers, type FormField } from "@/lib/forms";
import { applySubmission, createFormRequest, formFromTemplate, travelersForm } from "@/lib/form-answers";
import type { ActionState } from "@/components/form-controls";
import { logActivity } from "@/lib/events";
import { runEventWorkflows } from "@/lib/automations";

const FieldSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1).max(200),
  type: z.enum(FIELD_TYPES.map((t) => t.value) as [FormField["type"], ...FormField["type"][]]),
  required: z.boolean(),
  options: z.array(z.string().max(200)).max(50).optional(),
  mapTo: z.enum(["firstName", "lastName", "email", "phone", "city", "dietaryNotes", "accessibilityNotes", "preferenceNotes"]).optional(),
});

export async function createForm(formData: FormData) {
  const user = await requireUser();
  const template = FORM_TEMPLATES.find((t) => t.key === formData.get("template")) ?? FORM_TEMPLATES[0];
  const title = String(formData.get("title") ?? "").trim().slice(0, 200) || template.title;
  const form = await db.form.create({
    data: {
      organizationId: user.organizationId,
      title,
      description: template.description || null,
      fields: template.fields,
      slug: `${user.organization.marketingCode.toLowerCase()}-${shortCode(5).toLowerCase()}`,
    },
  });
  redirect(`/app/formularios/${form.id}`);
}

export async function saveForm(id: string, payload: { title: string; description: string; active: boolean; fields: FormField[] }) {
  const user = await requireUser();
  const fields = z.array(FieldSchema).min(1).max(60).safeParse(payload.fields);
  if (!fields.success) return { error: "Revisá los campos: todos necesitan un título." };
  if (!payload.title.trim()) return { error: "Poné un título al formulario" };
  const res = await db.form.updateMany({
    where: { id, organizationId: user.organizationId },
    data: { title: payload.title.trim(), description: payload.description.trim() || null, active: payload.active, fields: fields.data },
  });
  if (res.count === 0) return { error: "Formulario no encontrado" };
  revalidatePath(`/app/formularios/${id}`);
  return { ok: true as const };
}

export async function deleteForm(id: string) {
  const user = await requireUser();
  await db.form.deleteMany({ where: { id, organizationId: user.organizationId } });
  redirect("/app/formularios");
}

/**
 * Asocia una respuesta del link público a un cliente: el elegido, el que tiene ese email, o uno nuevo
 * (solo si la respuesta trae nombre). Después hay que pasarla a la ficha (applyAnswers).
 */
export async function linkSubmission(submissionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const sub = await db.formSubmission.findFirst({ where: { id: submissionId, form: { organizationId: user.organizationId } }, include: { form: true } });
  if (!sub) return { error: "Respuesta no encontrada" };
  const data = (sub.data ?? {}) as Answers;
  const fields = sub.form.fields as FormField[];
  const mapped: Record<string, string> = {};
  for (const field of fields) {
    const v = data[field.id];
    if (field.mapTo && typeof v === "string" && v.trim()) mapped[field.mapTo] = v.trim();
  }
  const chosen = String(formData.get("clientId") ?? "");
  let client =
    chosen && chosen !== "new"
      ? await db.client.findFirst({ where: { id: chosen, organizationId: user.organizationId } })
      : mapped.email
        ? await db.client.findFirst({ where: { organizationId: user.organizationId, email: mapped.email.toLowerCase() } })
        : null;
  if (!client) {
    if (chosen !== "new") return { error: "Elegí a qué cliente corresponde" };
    if (!mapped.firstName) return { error: "La respuesta no trae nombre: elegí un cliente existente" };
    client = await db.client.create({
      data: {
        organizationId: user.organizationId,
        ownerId: user.id,
        firstName: mapped.firstName,
        lastName: mapped.lastName ?? "",
        email: mapped.email?.toLowerCase(),
        phone: mapped.phone,
        city: mapped.city,
        source: "QUOTE_FORM",
        inviteCode: await uniqueInviteCode(),
      },
    });
    await runEventWorkflows({ organizationId: user.organizationId, trigger: "CLIENT_CREATED", clientId: client.id });
  }
  await db.formSubmission.update({ where: { id: sub.id }, data: { clientId: client.id } });
  await logActivity({ organizationId: user.organizationId, clientId: client.id, userId: user.id, type: "form", description: `Respuesta de "${sub.form.title}" asociada` });
  revalidatePath(`/app/formularios/${sub.formId}`);
  return { ok: `Asociada a ${client.firstName} ${client.lastName}`.trim() };
}

/** Pasa una respuesta revisada a la ficha del cliente, a sus viajeros y a las notas del viaje. */
export async function applyAnswers(submissionId: string, formData: FormData) {
  const user = await requireUser();
  // Los cambios de los viajeros que el agente dejó marcados (si la revisión tenía casillas).
  const selected = formData.get("review") === "1" ? new Set(formData.getAll("apply").map(String)) : undefined;
  await applySubmission(submissionId, user.organizationId, user.id, selected);
  const sub = await db.formSubmission.findUnique({ where: { id: submissionId }, select: { formId: true, clientId: true, bookingId: true } });
  if (sub) {
    revalidatePath(`/app/formularios/${sub.formId}`);
    if (sub.clientId) revalidatePath(`/app/clientes/${sub.clientId}`);
    if (sub.bookingId) revalidatePath(`/app/viajes/${sub.bookingId}`);
  }
}

/** Envía un formulario a un cliente (y a un viaje), con link personal. */
export async function sendFormRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let formId = String(formData.get("formId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "") || null;
  if (!formId) return { error: "Elegí qué formulario enviar" };
  const client = await db.client.findFirst({ where: { id: clientId, organizationId: user.organizationId } });
  if (!client) return { error: "Cliente no encontrado" };
  const email = formData.get("email") === "on";
  if (email && !client.email) return { error: "El cliente no tiene email: copiá el link y mandáselo por WhatsApp" };
  // Una plantilla que la agencia todavía no creó: se crea al enviarla por primera vez.
  if (formId.startsWith("tpl:")) formId = (await formFromTemplate(user.organizationId, user.organization.marketingCode, formId.slice(4))).id;
  const { emailed } = await createFormRequest({ organizationId: user.organizationId, formId, clientId, bookingId, userId: user.id, email });
  revalidateRequest(clientId, bookingId);
  return { ok: emailed ? "Enviado por email. También lo ve en su portal." : "Listo: copiá el link para mandarlo por WhatsApp. También lo ve en su portal." };
}

/** "Pedir lo que falta": el formulario de datos de viajeros, para este viaje. */
export async function requestTravelerData(bookingId: string) {
  const user = await requireUser();
  const booking = await db.booking.findFirst({ where: { id: bookingId, organizationId: user.organizationId }, include: { client: true } });
  if (!booking) return;
  const form = await travelersForm(user.organizationId, user.organization.marketingCode);
  await createFormRequest({ organizationId: user.organizationId, formId: form.id, clientId: booking.clientId, bookingId, userId: user.id, email: !!booking.client.email });
  revalidateRequest(booking.clientId, bookingId);
}

/** Descarta (o vuelve a mostrar, con null) el aviso de datos de viajeros de un viaje. */
export async function dismissTravelerGaps(bookingId: string, signature: string | null) {
  const user = await requireUser();
  await db.booking.updateMany({ where: { id: bookingId, organizationId: user.organizationId }, data: { travelerGapsDismissed: signature } });
  revalidatePath(`/app/viajes/${bookingId}`);
}

export async function cancelFormRequest(id: string) {
  const user = await requireUser();
  const r = await db.formRequest.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!r || r.status === "ANSWERED") return;
  await db.formRequest.delete({ where: { id } });
  revalidateRequest(r.clientId, r.bookingId);
}

function revalidateRequest(clientId: string, bookingId: string | null) {
  revalidatePath(`/app/clientes/${clientId}`);
  if (bookingId) revalidatePath(`/app/viajes/${bookingId}`);
  revalidatePath("/app/formularios");
}
