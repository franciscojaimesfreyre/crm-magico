"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/components/form-controls";
import { ACTIVITY_TYPE_LABEL } from "@/lib/labels";
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

const ACTIVITY_TYPES = Object.keys(ACTIVITY_TYPE_LABEL) as ActivityType[];

/** Crea una actividad guardada o, con id, la edita. Las que crea o edita el agente son propias (custom). */
export async function saveActivityTemplate(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Poné un título" };
  const type = String(formData.get("type") ?? "CUSTOM") as ActivityType;
  const duration = Number(formData.get("durationMin"));
  const data = {
    title: title.slice(0, 300),
    type: ACTIVITY_TYPES.includes(type) ? type : "CUSTOM",
    location: String(formData.get("location") ?? "").trim().slice(0, 300) || null,
    durationMin: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    notes: String(formData.get("notes") ?? "").trim().slice(0, 2000) || null,
    custom: true,
  };
  if (id) {
    const res = await db.activityTemplate.updateMany({ where: { id, organizationId: user.organizationId }, data });
    if (res.count === 0) return { error: "No se encontró la actividad" };
  } else {
    await db.activityTemplate.create({ data: { ...data, organizationId: user.organizationId } });
  }
  revalidatePath("/app/actividades");
  return { ok: id ? "Cambios guardados" : "Actividad guardada" };
}

/** Guarda una actividad de un itinerario en las actividades del agente, para reusarla. */
export async function saveActivityFromItinerary(item: { type: ActivityType; title: string; location: string | null; notes: string | null; durationMin: number | null }) {
  const user = await requireUser();
  const title = item.title.trim().slice(0, 300);
  if (!title) return { error: "La actividad necesita un título" };
  const template = await db.activityTemplate.create({
    data: {
      organizationId: user.organizationId,
      type: ACTIVITY_TYPES.includes(item.type) ? item.type : "CUSTOM",
      title,
      location: item.location?.trim().slice(0, 300) || null,
      notes: item.notes?.trim().slice(0, 2000) || null,
      durationMin: item.durationMin && item.durationMin > 0 ? Math.round(item.durationMin) : null,
      custom: true,
    },
    select: { id: true, type: true, title: true, location: true, durationMin: true, notes: true },
  });
  revalidatePath("/app/actividades");
  return { template };
}

export async function deleteActivityTemplate(id: string) {
  const user = await requireUser();
  await db.activityTemplate.deleteMany({ where: { id, organizationId: user.organizationId } });
  revalidatePath("/app/actividades");
}
