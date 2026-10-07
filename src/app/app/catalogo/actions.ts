"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import type { ActionState } from "@/components/form-controls";
import type { CatalogKind, Destination, DiningStyle } from "@/generated/prisma/enums";

/** El catálogo es de toda la plataforma: solo lo editan sus administradores. */
async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) throw new Error("Solo los administradores de la plataforma editan el catálogo");
  return user;
}

function fields(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const int = (k: string) => {
    const n = Number(str(k));
    return str(k) && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const kind = (str("kind") || "ATTRACTION") as CatalogKind;
  return {
    kind,
    destination: str("destination") as Destination,
    area: str("area"),
    name: str("name"),
    minHeightIn: kind === "ATTRACTION" ? int("minHeightIn") : null,
    diningStyle: kind === "RESTAURANT" ? ((str("diningStyle") || null) as DiningStyle | null) : null,
    priceLevel: kind === "RESTAURANT" || kind === "SHOPPING" ? int("priceLevel") : null,
    mustDo: (kind === "ATTRACTION" || kind === "SHOW") && formData.get("mustDo") === "on",
    notes: str("notes") || null,
    closedFrom: parseDateInput(formData.get("closedFrom")),
    closedTo: parseDateInput(formData.get("closedTo")),
    ...(formData.get("verified") === "on" ? { verifiedAt: new Date() } : {}),
  };
}

function invalid(data: ReturnType<typeof fields>) {
  if (!data.destination || !data.area || !data.name) return "Completá destino, parque o zona y nombre";
  if (data.closedTo && !data.closedFrom) return "Indicá desde cuándo está cerrada";
  if (data.closedFrom && data.closedTo && data.closedTo < data.closedFrom) return "La reapertura es anterior al cierre";
  return null;
}

async function duplicated(data: ReturnType<typeof fields>, exceptId?: string) {
  const other = await db.catalogEntry.findUnique({
    where: { destination_area_name: { destination: data.destination, area: data.area, name: data.name } },
  });
  return other && other.id !== exceptId;
}

export async function createCatalogEntry(_: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const data = fields(formData);
  const error = invalid(data);
  if (error) return { error };
  if (await duplicated(data)) return { error: "Ya existe con ese nombre en ese parque o zona" };
  await db.catalogEntry.create({ data });
  redirect(`/app/catalogo?destino=${data.destination}`);
}

export async function updateCatalogEntry(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const data = fields(formData);
  const error = invalid(data);
  if (error) return { error };
  if (await duplicated(data, id)) return { error: "Ya existe con ese nombre en ese parque o zona" };
  await db.catalogEntry.update({ where: { id }, data });
  redirect(`/app/catalogo?destino=${data.destination}`);
}

export async function markCatalogVerified(id: string) {
  await requirePlatformAdmin();
  await db.catalogEntry.update({ where: { id }, data: { verifiedAt: new Date() } });
  revalidatePath("/app/catalogo");
}

/** Marca o desmarca un imperdible: se suma siempre al itinerario de su parque. */
export async function toggleCatalogMustDo(id: string) {
  await requirePlatformAdmin();
  const e = await db.catalogEntry.findUniqueOrThrow({ where: { id } });
  await db.catalogEntry.update({ where: { id }, data: { mustDo: !e.mustDo } });
  revalidatePath("/app/catalogo");
}

export async function deleteCatalogEntry(id: string) {
  await requirePlatformAdmin();
  await db.catalogEntry.delete({ where: { id } });
  revalidatePath("/app/catalogo");
}
