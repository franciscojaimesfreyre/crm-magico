"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/components/form-controls";
import type { ActivityType, TemplateCategory } from "@/generated/prisma/enums";

// ─── Plantillas de email ─────────────────────────────────────────────────────

function emailFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? "CUSTOM") as TemplateCategory,
    subject: String(formData.get("subject") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
  };
}

export async function saveEmailTemplate(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const data = emailFields(formData);
  if (!data.name || !data.subject || !data.body) return { error: "Completá nombre, asunto y mensaje" };
  if (id) {
    const res = await db.emailTemplate.updateMany({ where: { id, organizationId: user.organizationId }, data });
    if (res.count === 0) return { error: "Plantilla no encontrada" };
  } else {
    await db.emailTemplate.create({ data: { ...data, organizationId: user.organizationId } });
  }
  revalidatePath("/app/plantillas");
  return { ok: "Plantilla guardada" };
}

export async function deleteEmailTemplate(id: string) {
  const user = await requireUser();
  await db.emailTemplate.deleteMany({ where: { id, organizationId: user.organizationId } });
  revalidatePath("/app/plantillas");
}

// ─── Actividades reutilizables del itinerario ────────────────────────────────

export async function saveActivityTemplate(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Poné un título" };
  const duration = Number(formData.get("durationMin"));
  await db.activityTemplate.create({
    data: {
      organizationId: user.organizationId,
      title,
      type: String(formData.get("type") ?? "CUSTOM") as ActivityType,
      location: String(formData.get("location") ?? "").trim() || null,
      durationMin: Number.isFinite(duration) && duration > 0 ? duration : null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidatePath("/app/actividades");
  return { ok: "Actividad guardada" };
}

export async function deleteActivityTemplate(id: string) {
  const user = await requireUser();
  await db.activityTemplate.deleteMany({ where: { id, organizationId: user.organizationId } });
  revalidatePath("/app/actividades");
}
