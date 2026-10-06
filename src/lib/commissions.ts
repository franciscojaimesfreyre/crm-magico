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
      items: {
        include: { bookingItem: { include: { booking: { include: { client: true } } } } },
        orderBy: [{ bookingItem: { saleDate: "asc" } }, { bookingItem: { booking: { code: "asc" } } }],
      },
    },
  });
}

export type LoadedStatement = NonNullable<Awaited<ReturnType<typeof loadStatement>>>;

/** Recalcula el estado de la planilla según cuántas comisiones ya se cobraron. */
export async function refreshStatementStatus(statementId: string) {
  const s = await db.commissionStatement.findUnique({
    where: { id: statementId },
    include: { items: { include: { bookingItem: { select: { commissionStatus: true } } } } },
  });
  if (!s || s.items.length === 0) return;
  const paid = s.items.filter((i) => i.bookingItem.commissionStatus === "PAID").length;
  const status = paid === 0 ? (s.status === "DRAFT" ? "DRAFT" : "SENT") : paid === s.items.length ? "PAID" : "PARTIALLY_PAID";
  if (status !== s.status) await db.commissionStatement.update({ where: { id: statementId }, data: { status } });
}

export function statementTotals(s: LoadedStatement) {
  const byCurrency = new Map<string, { expected: number; received: number; pending: number }>();
  for (const row of s.items) {
    const cur = row.bookingItem.booking.currency;
    const t = byCurrency.get(cur) ?? { expected: 0, received: 0, pending: 0 };
    const expected = toNumber(row.expectedAmount);
    t.expected += expected;
    if (row.bookingItem.commissionStatus === "PAID") t.received += toNumber(row.bookingItem.commissionPaidAmount ?? expected);
    else t.pending += expected;
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
