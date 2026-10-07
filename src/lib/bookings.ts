import "server-only";
import { db } from "@/lib/db";
import { todayUTC, toNumber } from "@/lib/format";
import type { BookingStatus } from "@/generated/prisma/enums";
import { logActivity, notifyClient } from "@/lib/events";
import { BOOKING_STATUS_LABEL } from "@/lib/labels";
import { runEventWorkflows } from "@/lib/automations";
import { commissionFor } from "@/lib/trips";

/** Próximo código correlativo R-0001 dentro de la organización (atómico). */
export async function nextBookingCode(organizationId: string) {
  const org = await db.organization.update({
    where: { id: organizationId },
    data: { bookingSeq: { increment: 1 } },
    select: { bookingSeq: true },
  });
  return `R-${String(org.bookingSeq).padStart(4, "0")}`;
}

/** Tasa de comisión aplicable: la del servicio, si no la de la agencia del agente, si no la del agente. */
export async function resolveCommissionRate(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { organization: { include: { agency: true } } },
  });
  return toNumber(b.organization.agency?.defaultCommissionRate ?? b.organization.defaultCommissionRate);
}

/**
 * Recalcula la comisión de cada reserva y los totales del viaje (suma de sus reservas no canceladas).
 * Además avanza el viaje en el pipeline: con la primera reserva confirmada pasa a Reservado, y cuando
 * todas las reservas confirmadas quedaron saldadas con sus pagos, a Pagado.
 */
export async function recalcBookingTotals(bookingId: string, userId?: string | null) {
  const items = await db.bookingItem.findMany({ where: { bookingId }, include: { payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] } } });
  const fallbackRate = await resolveCommissionRate(bookingId);
  let total = 0;
  let commission = 0;
  for (const item of items) {
    const price = toNumber(item.price);
    // Lo pagado y la fecha en que quedó saldada salen de los pagos registrados.
    let paid = 0;
    let settledAt: Date | null = null;
    for (const p of item.payments) {
      paid = Math.round((paid + toNumber(p.amount)) * 100) / 100;
      if (!settledAt && price > 0 && paid >= price) settledAt = p.paidAt;
    }
    if (toNumber(item.paidAmount) !== paid || item.balancePaidAt?.getTime() !== settledAt?.getTime()) {
      await db.bookingItem.update({ where: { id: item.id }, data: { paidAmount: paid, balancePaidAt: settledAt } });
      item.balancePaidAt = settledAt;
    }
    const amount = commissionFor(item, fallbackRate);
    if (toNumber(item.commissionAmount) !== amount) {
      await db.bookingItem.update({ where: { id: item.id }, data: { commissionAmount: amount } });
    }
    if (item.status === "CANCELLED") continue;
    total += price;
    commission += amount;
  }
  const booking = await db.booking.update({
    where: { id: bookingId },
    data: { totalPrice: total, commissionAmount: Math.round(commission * 100) / 100 },
  });

  const confirmed = items.filter((i) => i.status === "CONFIRMED");
  if (confirmed.length > 0 && ["INQUIRY", "QUOTED"].includes(booking.status)) {
    await changeBookingStatus({ bookingId, status: "BOOKED", userId });
  } else if (
    booking.status === "BOOKED" &&
    confirmed.length > 0 &&
    !items.some((i) => i.status === "PENDING") &&
    confirmed.every((i) => i.balancePaidAt || toNumber(i.price) === 0)
  ) {
    await changeBookingStatus({ bookingId, status: "PAID_IN_FULL", userId });
  }
}

/** Confirma una reserva con el proveedor: queda registrada la fecha de venta (para la planilla). */
export function confirmationData(item: { saleDate: Date | null }) {
  return { status: "CONFIRMED" as const, saleDate: item.saleDate ?? todayUTC() };
}

/** Cambia el estado de un viaje registrando actividad y disparando automatizaciones. */
export async function changeBookingStatus(opts: {
  bookingId: string;
  status: BookingStatus;
  userId?: string | null;
}) {
  const before = await db.booking.findUniqueOrThrow({ where: { id: opts.bookingId } });
  if (before.status === opts.status) return before;
  const booking = await db.booking.update({
    where: { id: opts.bookingId },
    data: { status: opts.status },
  });
  await logActivity({
    organizationId: booking.organizationId,
    bookingId: booking.id,
    clientId: booking.clientId,
    userId: opts.userId,
    type: "status",
    description: `Estado: ${BOOKING_STATUS_LABEL[before.status]} → ${BOOKING_STATUS_LABEL[opts.status]}`,
  });
  if (["BOOKED", "PAID_IN_FULL"].includes(opts.status)) {
    await notifyClient({
      organizationId: booking.organizationId,
      clientId: booking.clientId,
      title: `Tu viaje "${booking.title}" está ${BOOKING_STATUS_LABEL[opts.status].toLowerCase()}`,
      link: `/portal/viajes/${booking.id}`,
    });
  }
  await runEventWorkflows({
    organizationId: booking.organizationId,
    trigger: "STATUS_CHANGED",
    bookingId: booking.id,
    clientId: booking.clientId,
    status: opts.status,
  });
  return booking;
}
