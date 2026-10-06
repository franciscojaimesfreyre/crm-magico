"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { shortCode } from "@/lib/crypto";
import { uniqueInviteCode } from "@/lib/invite";
import { FORM_TEMPLATES, FIELD_TYPES, type FormField } from "@/lib/forms";
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
  const form = await db.form.create({
    data: {
      organizationId: user.organizationId,
      title: template.title,
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

/** Crea (o vincula) un cliente a partir de una respuesta usando los campos mapeados. */
export async function convertSubmission(submissionId: string) {
  const user = await requireUser();
  const sub = await db.formSubmission.findFirst({ where: { id: submissionId, form: { organizationId: user.organizationId } }, include: { form: true } });
  if (!sub) return;
  const data = (sub.data ?? {}) as Record<string, string | boolean>;
  const fields = sub.form.fields as FormField[];
  const mapped: Record<string, string> = {};
  for (const field of fields) {
    const v = data[field.id];
    if (field.mapTo && typeof v === "string" && v.trim()) mapped[field.mapTo] = v.trim();
  }
  let client = mapped.email ? await db.client.findFirst({ where: { organizationId: user.organizationId, email: mapped.email.toLowerCase() } }) : null;
  if (client) {
    await db.client.update({
      where: { id: client.id },
      data: {
        phone: client.phone ?? mapped.phone,
        city: client.city ?? mapped.city,
        dietaryNotes: mapped.dietaryNotes ?? client.dietaryNotes,
        accessibilityNotes: mapped.accessibilityNotes ?? client.accessibilityNotes,
        preferenceNotes: mapped.preferenceNotes ?? client.preferenceNotes,
      },
    });
  } else {
    client = await db.client.create({
      data: {
        organizationId: user.organizationId,
        ownerId: user.id,
        firstName: mapped.firstName ?? "Sin nombre",
        lastName: mapped.lastName ?? "",
        email: mapped.email?.toLowerCase(),
        phone: mapped.phone,
        city: mapped.city,
        dietaryNotes: mapped.dietaryNotes,
        accessibilityNotes: mapped.accessibilityNotes,
        preferenceNotes: mapped.preferenceNotes,
        source: "QUOTE_FORM",
        inviteCode: await uniqueInviteCode(),
      },
    });
    await runEventWorkflows({ organizationId: user.organizationId, trigger: "CLIENT_CREATED", clientId: client.id });
  }
  // El resto de las respuestas queda como nota en la actividad del cliente.
  const summary = fields
    .filter((field) => !field.mapTo && data[field.id] !== undefined && data[field.id] !== "")
    .map((field) => `${field.label}: ${data[field.id] === true ? "Sí" : data[field.id] === false ? "No" : data[field.id]}`)
    .join(" · ");
  await logActivity({ organizationId: user.organizationId, clientId: client.id, userId: user.id, type: "form", description: `Formulario "${sub.form.title}"${summary ? ` — ${summary}` : ""}` });
  await db.formSubmission.update({ where: { id: sub.id }, data: { clientId: client.id } });
  revalidatePath(`/app/formularios/${sub.formId}`);
}
