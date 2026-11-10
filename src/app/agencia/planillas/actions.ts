"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAgencyUser } from "@/lib/auth";
import { parseDateInput, todayUTC } from "@/lib/format";
import { registerStatementPayment } from "@/lib/commissions";
import { logActivity, notifyStaff } from "@/lib/events";
import type { ActionState } from "@/components/form-controls";

/** La agencia registra lo que transfirió por una planilla de un agente: se reparte y le avisa al agente. */
export async function agencyRegisterPayment(statementId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgencyUser();
  const s = await db.commissionStatement.findFirst({ where: { id: statementId, agencyId: user.agencyId, sentAt: { not: null } } });
  if (!s) return { error: "Planilla no encontrada" };
  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const result = await registerStatementPayment(statementId, s.organizationId, { amount, paidAt: parseDateInput(formData.get("paidAt")) ?? todayUTC(), reference });
  if ("error" in result) return { error: result.error };
  await notifyStaff({
    organizationId: s.organizationId,
    userId: s.agentId,
    title: `${user.agency.name} registró un pago de comisiones (${amount.toFixed(2)})`,
    body: reference ?? undefined,
    link: `/app/comisiones/planillas/${statementId}`,
  });
  await logActivity({ organizationId: s.organizationId, type: "commission", description: `${user.agency.name} registró un pago de comisiones: ${amount.toFixed(2)}` });
  revalidatePath("/agencia/planillas", "layout");
  return { ok: "Pago registrado. El agente ya lo ve en su planilla." };
}
