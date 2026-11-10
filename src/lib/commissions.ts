import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { CommissionStatus } from "@/generated/prisma/enums";
import { COMMISSION_STATUS_LABEL, DESTINATION_LABEL, ITEM_TYPE_LABEL } from "@/lib/labels";
import { formatDate, parseDateInput, toNumber } from "@/lib/format";

export type CommissionFilters = {
  desde?: string;
  hasta?: string;
  base?: string; // "venta" | "viaje"
  estado?: string; // "pendientes" | "solicitadas" | "cobradas" | "todas"
  realizados?: string; // "1" = solo viajes que ya terminaron
};

/**
 * Ventas que entran en la planilla: cada reserva confirmada con un proveedor (paquete, tickets, auto…),
 * dentro del período elegido. Una misma familia puede aportar varias filas en un mismo viaje.
 */
export function commissionWhere(organizationId: string, f: CommissionFilters): Prisma.BookingItemWhereInput {
  const booking: Prisma.BookingWhereInput = { organizationId, status: { not: "CANCELLED" } };
  const where: Prisma.BookingItemWhereInput = { status: "CONFIRMED", booking };
  const from = parseDateInput(f.desde);
  const to = parseDateInput(f.hasta);
  if (from || to) {
    const range = { ...(from && { gte: from }), ...(to && { lte: to }) };
    if (f.base === "viaje") booking.endDate = range;
    else where.saleDate = range;
  }
  if (f.realizados === "1") {
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    booking.AND = [{ endDate: { lt: today } }];
  }
  const statusMap: Record<string, CommissionStatus[]> = {
    pendientes: ["PENDING", "REQUESTED"],
    solicitadas: ["REQUESTED"],
    cobradas: ["PAID"],
  };
  if (f.estado && statusMap[f.estado]) where.commissionStatus = { in: statusMap[f.estado] };
  return where;
}

export async function loadStatement(id: string, organizationId: string) {
  return db.commissionStatement.findFirst({
    where: { id, organizationId },
    include: {
      agency: true,
      agent: true,
      organization: true,
      payments: { orderBy: { paidAt: "asc" } },
      items: {
        include: { bookingItem: { include: { booking: { include: { client: true } }, statementItems: { where: { cancelledAt: null }, select: { statementId: true } } } } },
        orderBy: [{ bookingItem: { saleDate: "asc" } }, { bookingItem: { booking: { code: "asc" } } }],
      },
    },
  });
}

export type LoadedStatement = NonNullable<Awaited<ReturnType<typeof loadStatement>>>;

/** Lo cobrado de una reserva: el monto cobrado (aunque sea parcial) o, si está cobrada sin monto, lo esperado. */
export function receivedOf(item: { commissionStatus: string; commissionPaidAmount: unknown; commissionAmount: unknown }, expected?: number) {
  if (item.commissionPaidAmount !== null && item.commissionPaidAmount !== undefined) return toNumber(item.commissionPaidAmount as never);
  return item.commissionStatus === "PAID" ? (expected ?? toNumber(item.commissionAmount as never)) : 0;
}

/**
 * Recalcula el estado de la planilla según la plata (no según la cantidad de filas): Borrador hasta que se
 * envía; Enviada sin cobros; Cobrada en parte mientras falte plata; Cobrada cuando llegó todo lo esperado.
 * Las reservas canceladas dentro de la planilla no cuentan.
 */
export async function refreshStatementStatus(statementId: string) {
  const s = await db.commissionStatement.findUnique({
    where: { id: statementId },
    include: { items: { include: { bookingItem: { select: { commissionStatus: true, commissionPaidAmount: true, commissionAmount: true } } } } },
  });
  if (!s) return;
  const rows = s.items.filter((i) => !i.cancelledAt);
  const expected = rows.reduce((t, r) => t + toNumber(r.expectedAmount), 0);
  const received = rows.reduce((t, r) => t + receivedOf(r.bookingItem, toNumber(r.expectedAmount)), 0);
  const status = received <= 0 ? (s.sentAt ? "SENT" : "DRAFT") : received + 0.005 >= expected ? "PAID" : "PARTIALLY_PAID";
  if (status !== s.status) await db.commissionStatement.update({ where: { id: statementId }, data: { status } });
}

export function statementTotals(s: LoadedStatement) {
  const byCurrency = new Map<string, { expected: number; received: number; pending: number }>();
  for (const row of s.items) {
    if (row.cancelledAt) continue;
    const cur = row.bookingItem.booking.currency;
    const t = byCurrency.get(cur) ?? { expected: 0, received: 0, pending: 0 };
    const expected = toNumber(row.expectedAmount);
    const received = receivedOf(row.bookingItem, expected);
    t.expected += expected;
    t.received += received;
    t.pending += Math.max(0, expected - received);
    byCurrency.set(cur, t);
  }
  return [...byCurrency.entries()].map(([currency, t]) => ({ currency, ...t }));
}

export function statementFilename(s: LoadedStatement, ext: string) {
  const who = (s.agency?.name ?? "comisiones").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `planilla-${who}-${s.periodFrom.toISOString().slice(0, 10)}-a-${s.periodTo.toISOString().slice(0, 10)}.${ext}`;
}

/** Excel de la planilla para enviar a la agencia. */
export async function buildStatementWorkbook(s: LoadedStatement) {
  const wb = new ExcelJS.Workbook();
  wb.creator = s.organization.name;
  const ws = wb.addWorksheet("Comisiones", { views: [{ state: "frozen", ySplit: 7 }] });

  ws.mergeCells("A1:O1");
  ws.getCell("A1").value = "Planilla de comisiones";
  ws.getCell("A1").font = { size: 16, bold: true };
  const meta: [string, string][] = [
    ["Agente", s.agent?.name ? `${s.agent.name} — ${s.organization.name}` : s.organization.name],
    ["Agencia", s.agency?.name ?? "—"],
    ["Período", `${formatDate(s.periodFrom)} al ${formatDate(s.periodTo)} (${s.dateBasis === "TRAVEL_END" ? "por fecha de fin de viaje" : "por fecha de venta"})`],
    ["Generada", formatDate(new Date())],
  ];
  meta.forEach(([k, v], i) => {
    ws.getCell(`A${i + 2}`).value = k;
    ws.getCell(`A${i + 2}`).font = { bold: true };
    ws.getCell(`B${i + 2}`).value = v;
  });

  const headers = [
    "Viaje", "Cliente", "Destino", "Reserva", "Proveedor", "Confirmación", "Fecha de venta", "Desde", "Hasta",
    "Moneda", "Importe", "% comisión", "Comisión", "Estado", "Cobrada el",
  ];
  const headerRow = ws.getRow(7);
  headerRow.values = headers;
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } };
    c.alignment = { vertical: "middle", wrapText: true };
  });

  let row = 8;
  for (const line of s.items) {
    const r = line.bookingItem;
    const b = r.booking;
    const price = toNumber(r.price);
    const commission = toNumber(line.expectedAmount);
    ws.getRow(row).values = [
      b.code,
      `${b.client.firstName} ${b.client.lastName}`,
      DESTINATION_LABEL[b.destination],
      `${ITEM_TYPE_LABEL[r.type]}: ${r.description}`,
      r.supplier ?? "",
      r.confirmationNumber ?? "",
      r.saleDate ?? null,
      r.startDate ?? b.startDate ?? null,
      r.endDate ?? b.endDate ?? null,
      b.currency,
      price,
      price ? commission / price : null,
      commission,
      COMMISSION_STATUS_LABEL[r.commissionStatus],
      r.commissionPaidAt ?? null,
    ];
    ws.getRow(row).alignment = { vertical: "top", wrapText: true };
    row++;
  }
  const last = row - 1;
  if (s.items.length) {
    ws.getRow(row).values = ["Total", "", "", "", "", "", "", "", "", "", { formula: `SUM(K8:K${last})` }, "", { formula: `SUM(M8:M${last})` }];
    ws.getRow(row).font = { bold: true };
  }

  const widths = [10, 24, 20, 40, 20, 16, 13, 13, 13, 8, 13, 11, 13, 12, 13];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (const col of [7, 8, 9, 15]) ws.getColumn(col).numFmt = "dd/mm/yyyy";
  for (const col of [11, 13]) ws.getColumn(col).numFmt = "#,##0.00";
  ws.getColumn(12).numFmt = "0.0%";

  return Buffer.from(await wb.xlsx.writeBuffer());
}


// ─── Qué hacer con las comisiones ────────────────────────────────────────────

/** Días que la agencia tarda en pagar por defecto, si no se cargó otro. */
export const DEFAULT_PAYMENT_TERM_DAYS = 30;

export type CommissionStage = "ready" | "upcoming" | "draft" | "waiting" | "paid";

/**
 * Todas las ventas con comisión (reservas confirmadas de viajes no cancelados) clasificadas en lo que hay que
 * hacer: para pedir (el viaje ya terminó y no está en ninguna planilla), todavía no (el viaje no terminó),
 * en una planilla sin enviar, esperando el pago (planilla enviada) o cobradas.
 */
export async function commissionOverview(organizationId: string) {
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const items = await db.bookingItem.findMany({
    where: { status: "CONFIRMED", booking: { organizationId, status: { not: "CANCELLED" } } },
    include: {
      booking: { include: { client: { select: { firstName: true, lastName: true } } } },
      statementItems: { where: { cancelledAt: null }, include: { statement: { select: { id: true, status: true, sentAt: true, createdAt: true, agency: { select: { name: true } } } } } },
    },
    orderBy: [{ booking: { endDate: { sort: "asc", nulls: "last" } } }, { position: "asc" }],
  });
  const rows = items.map((i) => {
    const statement = i.statementItems.map((x) => x.statement).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    const expected = toNumber(i.commissionAmount);
    const received = receivedOf(i, expected);
    const ended = !!i.booking.endDate && i.booking.endDate < today;
    const stage: CommissionStage =
      i.commissionStatus === "PAID" ? "paid" : statement ? (statement.sentAt ? "waiting" : "draft") : ended ? "ready" : "upcoming";
    return { item: i, statement, expected, received, owed: Math.max(0, expected - received), ended, stage, currency: i.booking.currency };
  });
  const totals = new Map<string, { earned: number; received: number; owed: number; ready: number; waiting: number }>();
  for (const r of rows) {
    const t = totals.get(r.currency) ?? { earned: 0, received: 0, owed: 0, ready: 0, waiting: 0 };
    t.earned += r.expected;
    t.received += r.received;
    t.owed += r.owed;
    if (r.stage === "ready") t.ready += r.owed;
    if (r.stage === "waiting" || r.stage === "draft") t.waiting += r.owed;
    totals.set(r.currency, t);
  }
  return { rows, totals };
}

/** Planillas que todavía esperan plata, con cuántos días llevan y cuándo se espera el pago. */
export async function openStatements(organizationId: string) {
  const list = await db.commissionStatement.findMany({
    where: { organizationId, status: { not: "PAID" } },
    include: {
      agency: true,
      items: {
        include: {
          bookingItem: { include: { booking: { select: { currency: true } }, statementItems: { where: { cancelledAt: null }, select: { statementId: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return list.map((s) => {
    const rows = s.items.filter((i) => !i.cancelledAt);
    // Reservas que también están en otra planilla (se reclamarían dos veces).
    const repeated = rows.filter((r) => r.bookingItem.statementItems.some((x) => x.statementId !== s.id)).length;
    const currency = rows[0]?.bookingItem.booking.currency ?? "USD";
    const expected = rows.reduce((t, r) => t + toNumber(r.expectedAmount), 0);
    const received = rows.reduce((t, r) => t + receivedOf(r.bookingItem, toNumber(r.expectedAmount)), 0);
    const term = s.agency?.paymentTermDays ?? DEFAULT_PAYMENT_TERM_DAYS;
    const days = s.sentAt ? Math.floor((Date.now() - s.sentAt.getTime()) / 86400_000) : null;
    const dueAt = s.sentAt ? new Date(s.sentAt.getTime() + term * 86400_000) : null;
    return { statement: s, count: rows.length, repeated, currency, expected, received, owed: Math.max(0, expected - received), days, term, dueAt, late: days !== null && days > term };
  });
}

/**
 * Registra un pago de la agencia por una planilla y lo reparte entre sus reservas, en orden: cada una se
 * completa hasta su comisión esperada; si alcanza, queda cobrada; si no, queda con lo parcial. Lo que falte
 * queda como diferencia a reclamar.
 */
export async function registerStatementPayment(statementId: string, organizationId: string, input: { amount: number; paidAt: Date; reference: string | null }) {
  const s = await db.commissionStatement.findFirst({
    where: { id: statementId, organizationId },
    include: { items: { where: { cancelledAt: null }, include: { bookingItem: true }, orderBy: { bookingItem: { saleDate: "asc" } } } },
  });
  if (!s) return { error: "Planilla no encontrada" };
  if (!(input.amount > 0)) return { error: "Indicá cuánto pagó la agencia" };
  await db.statementPayment.create({ data: { statementId, amount: input.amount, paidAt: input.paidAt, reference: input.reference } });
  let left = input.amount;
  for (const row of s.items) {
    if (left <= 0.004) break;
    const expected = toNumber(row.expectedAmount);
    const already = receivedOf(row.bookingItem, expected);
    if (row.bookingItem.commissionStatus === "PAID" && already + 0.005 >= expected) continue;
    const give = Math.min(left, expected - already);
    if (give <= 0) continue;
    const total = Math.round((already + give) * 100) / 100;
    const full = total + 0.005 >= expected;
    await db.bookingItem.update({
      where: { id: row.bookingItemId },
      data: { commissionStatus: full ? "PAID" : "REQUESTED", commissionPaidAmount: total, commissionPaidAt: input.paidAt },
    });
    left -= give;
  }
  // Si pagó de más, el excedente queda en la última reserva (se ve como diferencia a favor).
  if (left > 0.004 && s.items.length) {
    const last = s.items[s.items.length - 1];
    const fresh = await db.bookingItem.findUniqueOrThrow({ where: { id: last.bookingItemId } });
    await db.bookingItem.update({ where: { id: last.bookingItemId }, data: { commissionPaidAmount: Math.round((receivedOf(fresh) + left) * 100) / 100, commissionStatus: "PAID", commissionPaidAt: input.paidAt } });
  }
  if (!s.sentAt) await db.commissionStatement.update({ where: { id: statementId }, data: { sentAt: input.paidAt } });
  await refreshStatementStatus(statementId);
  return { ok: true as const };
}

/**
 * Una reserva se canceló: sale de sus planillas. Si la agencia ya la había pagado, queda marcada para
 * devolver y se crea una tarea; si no, simplemente deja de contar.
 */
export async function onReservationCancelled(bookingItemId: string, userId?: string | null) {
  const rows = await db.commissionStatementItem.findMany({
    where: { bookingItemId, cancelledAt: null },
    include: { statement: { include: { agency: true } }, bookingItem: { include: { booking: { include: { client: true } } } } },
  });
  for (const row of rows) {
    await db.commissionStatementItem.update({ where: { id: row.id }, data: { cancelledAt: new Date() } });
    const i = row.bookingItem;
    const received = receivedOf(i, toNumber(row.expectedAmount));
    if (received > 0) {
      await db.task.create({
        data: {
          organizationId: row.statement.organizationId,
          assigneeId: i.booking.agentId ?? userId ?? null,
          bookingId: i.bookingId,
          clientId: i.booking.clientId,
          title: `Devolver a ${row.statement.agency?.name ?? "la agencia"} la comisión de ${i.description} (cancelada)`,
          description: `Ya se había cobrado ${received.toFixed(2)} ${i.booking.currency}. Descontalo de la próxima planilla o devolvelo.`,
          priority: "HIGH",
          dueDate: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())),
          automated: true,
        },
      });
    }
    await refreshStatementStatus(row.statementId);
  }
}

/** Planillas enviadas que pasaron el plazo de pago sin cobrarse: una tarea para reclamar (cada 14 días como mucho). */
export async function remindOverdueStatements(organizationId: string) {
  let n = 0;
  for (const o of await openStatements(organizationId)) {
    if (!o.late || o.owed <= 0) continue;
    const s = o.statement;
    if (s.remindedAt && Date.now() - s.remindedAt.getTime() < 14 * 86400_000) continue;
    await db.task.create({
      data: {
        organizationId,
        assigneeId: s.agentId,
        title: `Reclamar a ${s.agency?.name ?? "la agencia"} la planilla del ${formatDate(s.periodFrom)} al ${formatDate(s.periodTo)}: ${o.days} días sin pago`,
        description: `Falta cobrar ${o.owed.toFixed(2)} ${o.currency}.`,
        priority: "HIGH",
        dueDate: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())),
        automated: true,
      },
    });
    await db.commissionStatement.update({ where: { id: s.id }, data: { remindedAt: new Date() } });
    n++;
  }
  return n;
}
