"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import { splitList } from "@/lib/clients";
import { AIError, askKnowledge } from "@/lib/ai";
import type { ActionState } from "@/components/form-controls";
import type { Destination, KnowledgeCategory } from "@/generated/prisma/enums";
import { KnowledgeExportItemSchema, KnowledgeFileSchema } from "@/lib/knowledge-io";

function fields(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const url = str("sourceUrl");
  return {
    title: str("title"),
    content: str("content"),
    category: (str("category") || "NEWS") as KnowledgeCategory,
    destinations: formData.getAll("destinations").map(String) as Destination[],
    park: str("park") || null,
    tags: splitList(formData.get("tags")),
    validFrom: parseDateInput(formData.get("validFrom")),
    validTo: parseDateInput(formData.get("validTo")),
    sourceUrl: /^https?:\/\//.test(url) ? url : null,
    published: formData.get("published") === "on",
    pinned: formData.get("pinned") === "on",
  };
}

/** Solo el administrador de la plataforma crea o edita novedades globales. */
async function canEdit(itemId: string) {
  const user = await requireUser();
  const item = await db.knowledgeItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Novedad no encontrada");
  const allowed = item.organizationId === user.organizationId || (item.organizationId === null && user.isPlatformAdmin);
  if (!allowed) throw new Error("No podés editar esta novedad");
  return { user, item };
}

export async function createKnowledge(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const data = fields(formData);
  if (!data.title || !data.content) return { error: "Completá título y contenido" };
  if (data.validFrom && data.validTo && data.validTo < data.validFrom) return { error: "La vigencia termina antes de empezar" };
  const global = formData.get("scope") === "global" && user.isPlatformAdmin;
  await db.knowledgeItem.create({ data: { ...data, organizationId: global ? null : user.organizationId } });
  redirect("/app/novedades");
}

export async function updateKnowledge(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await canEdit(id);
  const data = fields(formData);
  if (!data.title || !data.content) return { error: "Completá título y contenido" };
  if (data.validFrom && data.validTo && data.validTo < data.validFrom) return { error: "La vigencia termina antes de empezar" };
  await db.knowledgeItem.update({ where: { id }, data });
  redirect("/app/novedades");
}

export async function deleteKnowledge(id: string) {
  await canEdit(id);
  await db.knowledgeItem.delete({ where: { id } });
  revalidatePath("/app/novedades");
}

export async function askKnowledgeAction(_: unknown, formData: FormData) {
  const user = await requireUser();
  const question = String(formData.get("question") ?? "").trim();
  if (!question) return { error: "Escribí una pregunta" };
  try {
    return { question, ...(await askKnowledge({ organizationId: user.organizationId, question })) };
  } catch (e) {
    if (e instanceof AIError) return { error: e.message };
    console.error(e);
    return { error: "No se pudo consultar a la IA." };
  }
}

/**
 * Agrega las novedades de un JSON exportado. No pisa ni borra nada: las que ya existen con el mismo
 * título (en la plataforma o en la agencia, según corresponda) se saltean.
 */
export async function importKnowledge(json: string) {
  const user = await requireUser();
  if (json.length > 5_000_000) return { error: "El archivo es demasiado grande (máximo 5 MB)." };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: "El archivo no es un JSON válido." };
  }
  const file = KnowledgeFileSchema.safeParse(raw);
  if (!file.success) return { error: "El JSON no tiene el formato de novedades exportadas." };

  let created = 0;
  let skipped = 0;
  let invalid = 0;
  let asAgency = 0;
  for (const entry of file.data.items) {
    const parsed = KnowledgeExportItemSchema.safeParse(entry);
    if (!parsed.success || (parsed.data.validFrom && parsed.data.validTo && parsed.data.validTo < parsed.data.validFrom)) {
      invalid++;
      continue;
    }
    const { scope, validFrom, validTo, ...item } = parsed.data;
    const global = scope === "global" && user.isPlatformAdmin;
    if (scope === "global" && !global) asAgency++;
    const organizationId = global ? null : user.organizationId;
    if (await db.knowledgeItem.findFirst({ where: { organizationId, title: item.title }, select: { id: true } })) {
      skipped++;
      continue;
    }
    await db.knowledgeItem.create({
      data: {
        ...item,
        organizationId,
        validFrom: validFrom ? new Date(`${validFrom}T00:00:00.000Z`) : null,
        validTo: validTo ? new Date(`${validTo}T00:00:00.000Z`) : null,
      },
    });
    created++;
  }
  revalidatePath("/app/novedades");
  return { created, skipped, invalid, asAgency };
}
