"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { findAgencyByCode, isPlatformAgency, joinAgency, leaveAgency } from "@/lib/agencies";
import type { ActionState } from "@/components/form-controls";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const rate = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};

export async function updateOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = str(formData, "name");
  if (!name) return { error: "El nombre es obligatorio" };
  const code = (str(formData, "marketingCode") ?? user.organization.marketingCode).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 3) return { error: "El código debe tener al menos 3 letras o números" };
  if (code !== user.organization.marketingCode && (await db.organization.findUnique({ where: { marketingCode: code } }))) {
    return { error: "Ese código ya está en uso" };
  }
  const color = str(formData, "primaryColor");
  const logo = str(formData, "logoUrl");
  await db.organization.update({
    where: { id: user.organizationId },
    data: {
      name,
      marketingCode: code,
      tagline: str(formData, "tagline"),
      bio: str(formData, "bio"),
      contactEmail: str(formData, "contactEmail"),
      contactPhone: str(formData, "contactPhone"),
      logoUrl: logo && /^https?:\/\//.test(logo) ? logo : null,
      primaryColor: color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#7c3aed",
      defaultCurrency: str(formData, "defaultCurrency") ?? "USD",
      defaultCommissionRate: rate(formData, "defaultCommissionRate") ?? 10,
    },
  });
  revalidatePath("/app", "layout");
  return { ok: "Datos guardados" };
}

/** Datos de la agencia que le paga al agente independiente (solo para sus planillas). */
export async function saveMyAgency(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = user.organization.agency;
  if (isPlatformAgency(current)) return { error: "Los datos de tu agencia los administra ella desde su cuenta" };
  const name = str(formData, "name");
  if (!name) return { error: "Poné el nombre de la agencia" };
  const data = {
    name,
    contactName: str(formData, "contactName"),
    contactEmail: str(formData, "contactEmail"),
    defaultCommissionRate: rate(formData, "defaultCommissionRate"),
    notes: str(formData, "notes"),
  };
  if (current) await db.agency.update({ where: { id: current.id }, data });
  else await db.organization.update({ where: { id: user.organizationId }, data: { agency: { create: data } } });
  revalidatePath("/app", "layout");
  return { ok: "Agencia guardada" };
}

/** El agente se suma a una agencia de la plataforma con el código que ella le pasó. */
export async function joinAgencyWithCode(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const agency = await findAgencyByCode(formData.get("code"));
  if (!agency) return { error: "No encontramos una agencia con ese código" };
  if (agency.id === user.organization.agencyId) return { ok: `Ya trabajás con ${agency.name}` };
  await joinAgency(user.organizationId, agency.id);
  revalidatePath("/app", "layout");
  return { ok: `Listo, ahora trabajás con ${agency.name}` };
}

export async function leaveCurrentAgency() {
  const user = await requireUser();
  if (!isPlatformAgency(user.organization.agency)) return;
  await leaveAgency(user.organizationId);
  revalidatePath("/app", "layout");
}

export async function updateMyAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = str(formData, "name");
  if (!name) return { error: "Ingresá tu nombre" };
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const data: { name: string; phone: string | null; passwordHash?: string } = { name, phone: str(formData, "phone") };
  if (next) {
    if (next.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres" };
    if (!(await verifyPassword(current, user.passwordHash))) return { error: "La contraseña actual no es correcta" };
    data.passwordHash = await hashPassword(next);
  }
  await db.user.update({ where: { id: user.id }, data });
  revalidatePath("/app", "layout");
  return { ok: next ? "Datos y contraseña actualizados" : "Datos actualizados" };
}

export async function regenerateIcalToken() {
  const user = await requireUser();
  const { randomUUID } = await import("node:crypto");
  await db.organization.update({ where: { id: user.organizationId }, data: { icalToken: randomUUID() } });
  revalidatePath("/app/calendario");
  revalidatePath("/app/configuracion");
}
