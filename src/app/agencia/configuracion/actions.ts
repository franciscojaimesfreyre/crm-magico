"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, requireAgencyUser, verifyPassword } from "@/lib/auth";
import { leaveAgency, newInviteCode } from "@/lib/agencies";
import type { ActionState } from "@/components/form-controls";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

export async function updateAgency(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgencyUser();
  const name = str(formData, "name");
  if (!name) return { error: "El nombre es obligatorio" };
  const rateRaw = str(formData, "defaultCommissionRate");
  const rate = rateRaw === null ? null : Number(rateRaw.replace(",", "."));
  if (rate !== null && !(Number.isFinite(rate) && rate >= 0 && rate <= 100)) return { error: "La comisión tiene que ser un porcentaje entre 0 y 100" };
  await db.agency.update({
    where: { id: user.agencyId },
    data: {
      name,
      contactName: str(formData, "contactName"),
      contactEmail: str(formData, "contactEmail"),
      defaultCommissionRate: rate,
      notes: str(formData, "notes"),
    },
  });
  revalidatePath("/agencia", "layout");
  return { ok: "Datos guardados" };
}

/** Código nuevo: el anterior deja de servir para sumarse (los agentes que ya están no se ven afectados). */
export async function regenerateInviteCode() {
  const user = await requireAgencyUser();
  await db.agency.update({ where: { id: user.agencyId }, data: { inviteCode: await newInviteCode(user.agency.name) } });
  revalidatePath("/agencia/configuracion");
}

/** Deja de trabajar con un agente. Sus datos no cambian: la agencia solo deja de ver sus números. */
export async function removeAgent(organizationId: string) {
  const user = await requireAgencyUser();
  const org = await db.organization.findFirst({ where: { id: organizationId, agencyId: user.agencyId }, select: { id: true } });
  if (!org) return;
  await leaveAgency(org.id);
  revalidatePath("/agencia", "layout");
}

export async function updateAgencyAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgencyUser();
  const name = str(formData, "name");
  if (!name) return { error: "Ingresá tu nombre" };
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const data: { name: string; passwordHash?: string } = { name };
  if (next) {
    if (next.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres" };
    if (!(await verifyPassword(current, user.passwordHash))) return { error: "La contraseña actual no es correcta" };
    data.passwordHash = await hashPassword(next);
  }
  await db.user.update({ where: { id: user.id }, data });
  revalidatePath("/agencia", "layout");
  return { ok: next ? "Datos y contraseña actualizados" : "Datos actualizados" };
}
