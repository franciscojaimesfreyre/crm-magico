"use server";

import { db } from "@/lib/db";
import { notifyStaff } from "@/lib/events";
import type { FormField } from "@/lib/forms";
import type { ActionState } from "@/components/form-controls";

export async function submitForm(slug: string, _: ActionState, formData: FormData): Promise<ActionState> {
  if (String(formData.get("website") ?? "")) return { ok: "¡Gracias!" };
  const form = await db.form.findUnique({ where: { slug } });
  if (!form || !form.active) return { error: "Este formulario no está recibiendo respuestas." };
  const fields = form.fields as FormField[];
  const data: Record<string, string | boolean> = {};
  for (const f of fields) {
    if (f.type === "checkbox") {
      data[f.id] = formData.get(f.id) === "on";
      continue;
    }
    const value = String(formData.get(f.id) ?? "").trim().slice(0, 5000);
    if (f.required && !value) return { error: `Completá: ${f.label}` };
    if (f.type === "email" && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return { error: `Email inválido en: ${f.label}` };
    if (f.type === "select" && value && f.options && !f.options.includes(value)) return { error: `Opción inválida en: ${f.label}` };
    data[f.id] = value;
  }
  await db.formSubmission.create({ data: { formId: form.id, data } });
  await notifyStaff({ organizationId: form.organizationId, title: `Nueva respuesta: ${form.title}`, link: `/app/formularios/${form.id}?tab=respuestas` });
  return { ok: "¡Gracias! Recibimos tus respuestas." };
}
