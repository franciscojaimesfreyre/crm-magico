"use server";

import { db } from "@/lib/db";
import { notifyStaff } from "@/lib/events";
import { parseAnswers, respondentName } from "@/lib/form-answers";
import { isPersonalForm, type FormField } from "@/lib/forms";
import type { ActionState } from "@/components/form-controls";

/** Respuesta por el link público (sin cliente): queda para que el agente la asocie. */
export async function submitForm(slug: string, _: ActionState, formData: FormData): Promise<ActionState> {
  if (String(formData.get("website") ?? "")) return { ok: "¡Gracias!" };
  const form = await db.form.findUnique({ where: { slug } });
  if (!form || !form.active) return { error: "Este formulario no está recibiendo respuestas." };
  const fields = form.fields as FormField[];
  if (isPersonalForm(fields)) return { error: "Este formulario se completa con el link personal que te mandó tu agente." };
  const parsed = parseAnswers(fields, formData);
  if ("error" in parsed) return parsed;
  const sub = await db.formSubmission.create({ data: { formId: form.id, data: parsed.data } });
  const who = respondentName(fields, parsed.data);
  await notifyStaff({
    organizationId: form.organizationId,
    title: `${who || "Alguien"} respondió "${form.title}"`,
    link: `/app/formularios/${form.id}?tab=respuestas#r-${sub.id}`,
  });
  return { ok: "¡Gracias! Recibimos tus respuestas." };
}
