"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAgencyUser } from "@/lib/auth";
import type { ActionState } from "@/components/form-controls";

/** La agencia define qué parte de la comisión del proveedor le transfiere a este agente (vacío = la general). */
export async function setAgentShare(organizationId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgencyUser();
  const raw = String(formData.get("agentSharePercent") ?? "").trim().replace(",", ".");
  const n = Number(raw);
  if (raw && !(Number.isFinite(n) && n >= 0 && n <= 100)) return { error: "Tiene que ser un porcentaje entre 0 y 100" };
  const res = await db.organization.updateMany({ where: { id: organizationId, agencyId: user.agencyId }, data: { agentSharePercent: raw ? n : null } });
  if (res.count === 0) return { error: "Agente no encontrado" };
  revalidatePath("/agencia", "layout");
  return { ok: "Guardado. Se aplica a lo que el agente todavía no reclamó en una planilla." };
}
