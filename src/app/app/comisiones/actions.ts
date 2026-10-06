"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDateInput, todayUTC, toNumber } from "@/lib/format";
import { buildStatementWorkbook, loadStatement, refreshStatementStatus, statementFilename } from "@/lib/commissions";
import { sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/events";
import type { ActionState } from "@/components/form-controls";

/** Reservas seleccionadas en la pantalla de comisiones (cada una es una venta). */
async function selectedItems(formData: FormData) {
  const user = await requireUser();
  const ids = formData.getAll("itemIds").map(String);
  const items = await db.bookingItem.findMany({
    where: { id: { in: ids }, booking: { organizationId: user.organizationId } },
    include: { booking: { select: { clientId: true } } },
  });
  return { user, items };
}

function back(formData: FormData) {
  const to = String(formData.get("returnTo") ?? "/app/comisiones");
  return to.startsWith("/app/comisiones") ? to : "/app/comisiones";
}

/** Marca como cobradas las comisiones seleccionadas (monto = comisión esperada). */
export async function markCommissionsPaid(formData: FormData) {
  const { user, items } = await selectedItems(formData);
  const paidAt = parseDateInput(formData.get("paidAt")) ?? todayUTC();
  for (const i of items) {
    await db.bookingItem.update({
      where: { id: i.id },
      data: { commissionStatus: "PAID", commissionPaidAt: paidAt, commissionPaidAmount: i.commissionPaidAmount ?? i.commissionAmount },
    });
    await logActivity({ organizationId: user.organizationId, bookingId: i.bookingId, clientId: i.booking.clientId, userId: user.id, type: "commission", description: `Comisión cobrada: ${i.description}` });
  }
  await refreshStatementsFor(items.map((i) => i.id));
  revalidatePath("/app/comisiones", "layout");
  redirect(back(formData));
}

export async function markCommissionsPending(formData: FormData) {
  const { items } = await selectedItems(formData);
  await db.bookingItem.updateMany({
    where: { id: { in: items.map((i) => i.id) } },
    data: { commissionStatus: "PENDING", commissionPaidAt: null, commissionPaidAmount: null },
  });
  await refreshStatementsFor(items.map((i) => i.id));
  revalidatePath("/app/comisiones", "layout");
  redirect(back(formData));
}

async function refreshStatementsFor(itemIds: string[]) {
  const rows = await db.commissionStatementItem.findMany({ where: { bookingItemId: { in: itemIds } }, select: { statementId: true } });
  for (const id of new Set(rows.map((r) => r.statementId))) await refreshStatementStatus(id);
}

/** Crea una planilla con las reservas seleccionadas y pasa sus comisiones a "Solicitada". */
export async function createStatement(formData: FormData) {
  const { user, items } = await selectedItems(formData);
  if (items.length === 0) redirect(`${back(formData)}${back(formData).includes("?") ? "&" : "?"}error=sin-seleccion`);
  const from = parseDateInput(formData.get("desde")) ?? items.map((i) => i.saleDate ?? i.createdAt).sort((a, b) => a.getTime() - b.getTime())[0];
  const to = parseDateInput(formData.get("hasta")) ?? todayUTC();
  const statement = await db.commissionStatement.create({
    data: {
      organizationId: user.organizationId,
      agencyId: user.organization.agencyId,
      agentId: user.id,
      periodFrom: from,
      periodTo: to,
      dateBasis: formData.get("base") === "viaje" ? "TRAVEL_END" : "SALE",
      items: { create: items.map((i) => ({ bookingItemId: i.id, expectedAmount: i.commissionAmount })) },
    },
  });
  await db.bookingItem.updateMany({
    where: { id: { in: items.map((i) => i.id) }, commissionStatus: "PENDING" },
    data: { commissionStatus: "REQUESTED" },
  });
  redirect(`/app/comisiones/planillas/${statement.id}`);
}

export async function updateStatementItem(statementId: string, bookingItemId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const row = await db.commissionStatementItem.findFirst({
    where: { statementId, bookingItemId, statement: { organizationId: user.organizationId } },
  });
  if (!row) return { error: "No encontrado" };
  const paid = formData.get("paid") === "on";
  const amountRaw = String(formData.get("amount") ?? "").replace(",", ".");
  const amount = amountRaw ? Number(amountRaw) : toNumber(row.expectedAmount);
  await db.bookingItem.update({
    where: { id: bookingItemId },
    data: paid
      ? { commissionStatus: "PAID", commissionPaidAt: parseDateInput(formData.get("paidAt")) ?? todayUTC(), commissionPaidAmount: Number.isFinite(amount) ? amount : row.expectedAmount }
      : { commissionStatus: "REQUESTED", commissionPaidAt: null, commissionPaidAmount: null },
  });
  await refreshStatementStatus(statementId);
  revalidatePath(`/app/comisiones/planillas/${statementId}`);
  return { ok: paid ? "Cobrada" : "Pendiente" };
}

export async function markStatementPaid(statementId: string, formData: FormData) {
  const user = await requireUser();
  const s = await db.commissionStatement.findFirst({
    where: { id: statementId, organizationId: user.organizationId },
    include: { items: { include: { bookingItem: true } } },
  });
  if (!s) return;
  const paidAt = parseDateInput(formData.get("paidAt")) ?? todayUTC();
  for (const row of s.items) {
    if (row.bookingItem.commissionStatus === "PAID") continue;
    await db.bookingItem.update({
      where: { id: row.bookingItemId },
      data: { commissionStatus: "PAID", commissionPaidAt: paidAt, commissionPaidAmount: row.expectedAmount },
    });
  }
  await refreshStatementStatus(statementId);
  revalidatePath(`/app/comisiones/planillas/${statementId}`);
}

export async function removeStatementItem(statementId: string, bookingItemId: string) {
  const user = await requireUser();
  const row = await db.commissionStatementItem.findFirst({ where: { statementId, bookingItemId, statement: { organizationId: user.organizationId } } });
  if (!row) return;
  await db.commissionStatementItem.delete({ where: { id: row.id } });
  await db.bookingItem.updateMany({ where: { id: bookingItemId, commissionStatus: "REQUESTED" }, data: { commissionStatus: "PENDING" } });
  await refreshStatementStatus(statementId);
  revalidatePath(`/app/comisiones/planillas/${statementId}`);
}

export async function updateStatementNotes(statementId: string, formData: FormData) {
  const user = await requireUser();
  await db.commissionStatement.updateMany({
    where: { id: statementId, organizationId: user.organizationId },
    data: { notes: String(formData.get("notes") ?? "").trim() || null },
  });
  revalidatePath(`/app/comisiones/planillas/${statementId}`);
}

export async function deleteStatement(statementId: string) {
  const user = await requireUser();
  const s = await db.commissionStatement.findFirst({ where: { id: statementId, organizationId: user.organizationId }, include: { items: true } });
  if (!s) return;
  // Las reservas solicitadas solo en esta planilla vuelven a "Pendiente".
  for (const row of s.items) {
    const others = await db.commissionStatementItem.count({ where: { bookingItemId: row.bookingItemId, statementId: { not: statementId } } });
    if (others === 0) await db.bookingItem.updateMany({ where: { id: row.bookingItemId, commissionStatus: "REQUESTED" }, data: { commissionStatus: "PENDING" } });
  }
  await db.commissionStatement.delete({ where: { id: statementId } });
  redirect("/app/comisiones/planillas");
}

/** Envía la planilla en Excel a la agencia y la marca como enviada. */
export async function emailStatement(statementId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const s = await loadStatement(statementId, user.organizationId);
  if (!s) return { error: "Planilla no encontrada" };
  const to = String(formData.get("to") ?? "").trim();
  if (!to) return { error: "Indicá el email de la agencia" };
  const buffer = await buildStatementWorkbook(s);
  const result = await sendEmail({
    organizationId: user.organizationId,
    to,
    subject: String(formData.get("subject") ?? "Planilla de comisiones"),
    body: String(formData.get("body") ?? ""),
    fromName: user.organization.name,
    attachments: [{ filename: statementFilename(s, "xlsx"), content: buffer, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
  });
  if (result.status === "FAILED") return { error: `No se pudo enviar: ${result.error}` };
  if (s.status === "DRAFT") await db.commissionStatement.update({ where: { id: statementId }, data: { status: "SENT" } });
  revalidatePath(`/app/comisiones/planillas/${statementId}`);
  return { ok: result.status === "SENT" ? "Planilla enviada a la agencia" : "Planilla registrada como enviada (configurá SMTP para que salga el email)" };
}

export async function markStatementSent(statementId: string) {
  const user = await requireUser();
  await db.commissionStatement.updateMany({ where: { id: statementId, organizationId: user.organizationId, status: "DRAFT" }, data: { status: "SENT" } });
  revalidatePath(`/app/comisiones/planillas/${statementId}`);
}
