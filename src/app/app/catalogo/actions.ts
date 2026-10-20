"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import type { ActionState } from "@/components/form-controls";
import { CATALOG_FORMAT, CatalogEntryExportSchema, CatalogFileSchema, ParkGuideExportSchema } from "@/lib/catalog-io";
import { parseSchedule } from "@/lib/park-sheet";
import { syncThemeParks } from "@/lib/themeparks-sync";
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
  // Si el administrador cambia el cierre que cargó ThemeParks.wiki, pasa a ser suyo: la sincronización no lo toca más.
  const before = await db.catalogEntry.findUniqueOrThrow({ where: { id }, select: { closedFrom: true, closedTo: true, closedByApi: true } });
  const same = (a: Date | null, b: Date | null) => a?.getTime() === b?.getTime();
  const closedByApi = before.closedByApi && same(before.closedFrom, data.closedFrom) && same(before.closedTo, data.closedTo);
  await db.catalogEntry.update({ where: { id }, data: { ...data, closedByApi } });
  redirect(`/app/catalogo?destino=${data.destination}`);
}

/** Trae ya de ThemeParks.wiki los horarios de las fichas y los cierres del catálogo (además de la sincronización diaria). */
export async function syncThemeParksNow() {
  await requirePlatformAdmin();
  try {
    const res = await syncThemeParks();
    revalidatePath("/app/catalogo");
    revalidatePath("/app/catalogo/fichas");
    return res;
  } catch (e) {
    console.error("Error sincronizando con ThemeParks.wiki", e);
    return { error: "No pudimos conectarnos con ThemeParks.wiki. Probá de nuevo en un rato." };
  }
}

/** Suma al catálogo un lugar que figura en ThemeParks.wiki (después se completa la altura, el precio…). */
export async function addCatalogEntryFromApi(input: { destination: Destination; area: string; name: string; kind: CatalogKind; apiId: string }) {
  await requirePlatformAdmin();
  const key = { destination_area_name: { destination: input.destination, area: input.area, name: input.name } };
  await db.catalogEntry.upsert({ where: key, create: input, update: { apiId: input.apiId } });
  revalidatePath("/app/catalogo");
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

// ─── Exportar / importar todo el catálogo ────────────────────────────────────

const toDay = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00.000Z`) : null);

/**
 * Importa un JSON exportado del catálogo. El catálogo es uno solo para toda la plataforma, así que
 * actualiza lo que ya existe (el mismo lugar en el mismo destino y zona; la misma ficha por nombre)
 * y agrega lo nuevo. No borra nada.
 */
export async function importCatalog(json: string) {
  await requirePlatformAdmin();
  if (json.length > 20_000_000) return { error: "El archivo es demasiado grande (máximo 20 MB)." };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: "El archivo no es un JSON válido." };
  }
  const file = CatalogFileSchema.safeParse(raw);
  if (!file.success || (file.data.format && file.data.format !== CATALOG_FORMAT)) return { error: "El JSON no tiene el formato del catálogo exportado." };

  const r = { entriesCreated: 0, entriesUpdated: 0, guidesCreated: 0, guidesUpdated: 0, invalid: 0 };
  for (const item of file.data.entries) {
    const parsed = CatalogEntryExportSchema.safeParse(item);
    if (!parsed.success || (parsed.data.closedFrom && parsed.data.closedTo && parsed.data.closedTo < parsed.data.closedFrom)) {
      r.invalid++;
      continue;
    }
    const { closedFrom, closedTo, verifiedAt, ...e } = parsed.data;
    const data = { ...e, closedFrom: toDay(closedFrom), closedTo: toDay(closedTo), verifiedAt: verifiedAt ? new Date(verifiedAt) : null };
    const key = { destination_area_name: { destination: e.destination, area: e.area, name: e.name } };
    const exists = await db.catalogEntry.findUnique({ where: key, select: { id: true } });
    await db.catalogEntry.upsert({ where: key, create: data, update: data });
    r[exists ? "entriesUpdated" : "entriesCreated"]++;
  }
  for (const item of file.data.guides) {
    const parsed = ParkGuideExportSchema.safeParse(item);
    if (!parsed.success || (parsed.data.kind === "EVENT" && !parsed.data.park)) {
      r.invalid++;
      continue;
    }
    const g = parsed.data;
    const existing = await db.parkGuide.findFirst({ where: { name: { equals: g.name, mode: "insensitive" } }, select: { id: true, schedule: true } });
    // Los días sincronizados con ThemeParks.wiki no vienen en el archivo: se conservan.
    const synced = existing ? parseSchedule(existing.schedule).filter((d) => d.synced && !g.schedule.some((x) => x.date === d.date)) : [];
    if (existing) await db.parkGuide.update({ where: { id: existing.id }, data: { ...g, schedule: parseSchedule([...g.schedule, ...synced]) } });
    else await db.parkGuide.create({ data: g });
    r[existing ? "guidesUpdated" : "guidesCreated"]++;
  }
  revalidatePath("/app/catalogo");
  revalidatePath("/app/catalogo/fichas");
  return r;
}
