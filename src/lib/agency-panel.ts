import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

// Lo que ve una agencia de sus agentes: solo números. Nunca datos de clientes, viajeros, notas ni mensajes,
// y nada que se pueda editar. Todas las consultas del panel pasan por acá.


/**
 * Cada venta es una reserva confirmada (paquete Disney, tickets, auto…) de un viaje no cancelado.
 * Solo se exponen datos del viaje y de la reserva: nunca el cliente.
 */
const SALE_SELECT = {
  id: true,
  type: true,
  supplier: true,
  price: true,
  saleDate: true,
  commissionAmount: true,
  commissionStatus: true,
  commissionPaidAt: true,
  commissionPaidAmount: true,
  booking: {
    select: { id: true, organizationId: true, code: true, destination: true, status: true, startDate: true, endDate: true, currency: true },
  },
} satisfies Prisma.BookingItemSelect;

type SaleRow = Prisma.BookingItemGetPayload<{ select: typeof SALE_SELECT }>;

function toSale(r: SaleRow) {
  return {
    id: r.id,
    bookingId: r.booking.id,
    organizationId: r.booking.organizationId,
    code: r.booking.code,
    destination: r.booking.destination,
    status: r.booking.status,
    startDate: r.booking.startDate,
    endDate: r.booking.endDate,
    currency: r.booking.currency,
    type: r.type,
    supplier: r.supplier,
    saleDate: r.saleDate,
    totalPrice: r.price,
    commissionAmount: r.commissionAmount,
    commissionStatus: r.commissionStatus,
    commissionPaidAt: r.commissionPaidAt,
    commissionPaidAmount: r.commissionPaidAmount,
  };
}

export type AgencySale = ReturnType<typeof toSale>;

const SOLD_ITEM: Prisma.BookingItemWhereInput = { status: "CONFIRMED", booking: { status: { not: "CANCELLED" } } };

/** Agentes que hoy trabajan con la agencia. */
export async function agencyAgents(agencyId: string) {
  return db.organization.findMany({
    where: { agencyId },
    select: {
      id: true,
      name: true,
      contactEmail: true,
      agencyJoinedAt: true,
      users: { select: { name: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
}

/** Un agente de la agencia, o null si no trabaja con ella. */
export async function agencyAgent(agencyId: string, organizationId: string) {
  return db.organization.findFirst({
    where: { id: organizationId, agencyId },
    select: { id: true, name: true, contactEmail: true, contactPhone: true, agencyJoinedAt: true, users: { select: { name: true }, take: 1 } },
  });
}

/** Ventas (reservas confirmadas) de los agentes de la agencia en un año, por fecha de venta, en una moneda. */
export async function agencySales(agencyId: string, opts: { year: number; currency: string; organizationId?: string }) {
  const rows = await db.bookingItem.findMany({
    where: {
      ...SOLD_ITEM,
      booking: {
        status: { not: "CANCELLED" },
        organization: { agencyId },
        currency: opts.currency,
        ...(opts.organizationId && { organizationId: opts.organizationId }),
      },
      saleDate: { gte: new Date(Date.UTC(opts.year, 0, 1)), lte: new Date(Date.UTC(opts.year, 11, 31)) },
    },
    select: SALE_SELECT,
    orderBy: { saleDate: "desc" },
  });
  return rows.map(toSale);
}

/** Monedas en las que vendieron los agentes de la agencia. */
export async function agencyCurrencies(agencyId: string) {
  const rows = await db.booking.findMany({
    where: { organization: { agencyId }, items: { some: { status: "CONFIRMED" } } },
    distinct: ["currency"],
    select: { currency: true },
  });
  return rows.map((r) => r.currency);
}

export function summarize(sales: AgencySale[]) {
  let revenue = 0;
  let commission = 0;
  let paid = 0;
  let pending = 0;
  for (const s of sales) {
    revenue += toNumber(s.totalPrice);
    commission += toNumber(s.commissionAmount);
    if (s.commissionStatus === "PAID") paid += toNumber(s.commissionPaidAmount ?? s.commissionAmount);
    else pending += toNumber(s.commissionAmount);
  }
  return { count: sales.length, revenue, commission, paid, pending };
}
