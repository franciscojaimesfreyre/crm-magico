import "server-only";
import { db } from "@/lib/db";
import { formatDate, todayUTC } from "@/lib/format";
import { recalcBookingTotals } from "@/lib/bookings";
import { logActivity, notifyClient, notifyStaff } from "@/lib/events";
import { suggestedBalanceDue } from "@/lib/trips";

/** Canales con los que el agente puede marcar que el cliente aceptó (o rechazó) fuera del portal. */
export const ACCEPTANCE_CHANNELS = ["WhatsApp", "Teléfono", "Email", "En persona", "Otro"] as const;

/** Vencida: tiene fecha de validez y ya pasó (el día de validez todavía vale). */
export function quoteExpired(quote: { validUntil: Date | null }) {
  return !!quote.validUntil && quote.validUntil < todayUTC();
}

type Acceptance = {
  quoteId: string;
  optionId: string;
  /** "portal" si la acepta el cliente; si la marca el agente, el canal por el que respondió. */
  via: string;
  comment: string | null;
  /** Agente que la marcó (vacío si la aceptó el cliente desde el portal). */
  userId?: string | null;
  /**
   * Reemplaza a las otras cotizaciones del viaje: vence las enviadas y saca las reservas por reservar que salieron
   * de otra cotización aceptada (sin pagos ni planilla). Sin esto, se suma: las cotizaciones pueden ser partes del
   * mismo viaje (el crucero y el paquete). Solo lo decide el agente.
   */
  replace?: boolean;
};

/**
 * Acepta una opción de una cotización y la convierte en reservas "por reservar" del viaje, vinculadas a sus
 * servicios. Cada dato se carga una vez: pasan el precio, la comisión, el depósito, los detalles y los viajeros
 * del viaje, y en los paquetes se sugiere la fecha de saldo. No se pierde ni se duplica nada:
 * - las reservas cargadas a mano no se tocan;
 * - si la cotización partió de una reserva existente, se actualiza esa (o se respeta, si ya está confirmada);
 * - las otras cotizaciones se tocan solo si el agente indica que esta las reemplaza (ver `replace`).
 */
export async function acceptQuoteOption({ quoteId, optionId, via, comment, userId, replace = false }: Acceptance) {
  const quote = await db.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: {
      booking: { include: { client: true, travelers: { select: { travelerId: true } } } },
      options: { include: { items: { orderBy: { position: "asc" } } } },
    },
  });
  const option = quote.options.find((o) => o.id === optionId);
  if (!option) throw new Error("Opción no encontrada");
  const booking = quote.booking;
  const travelerIds = booking.travelers.map((t) => t.travelerId);

  await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: { status: "ACCEPTED", acceptedOptionId: option.id, acceptedVia: via, respondedAt: new Date(), clientComment: comment },
    });
    if (replace) {
      // Las otras cotizaciones enviadas quedan vencidas, y lo que salió de otra aceptada antes y sigue sin
      // tocar (por reservar, sin pagos ni planilla) se reemplaza por lo nuevo.
      await tx.quote.updateMany({ where: { bookingId: booking.id, id: { not: quoteId }, status: "SENT" }, data: { status: "EXPIRED" } });
      const keep = option.items.map((i) => i.sourceItemId).filter((id): id is string => !!id);
      await tx.bookingItem.deleteMany({
        where: {
          bookingId: booking.id,
          status: "PENDING",
          quoteItemId: { not: null },
          quoteItem: { option: { quoteId: { not: quoteId } } },
          id: { notIn: keep },
          payments: { none: {} },
          statementItems: { none: {} },
        },
      });
    }

    let position = await tx.bookingItem.count({ where: { bookingId: booking.id } });
    for (const i of option.items) {
      const fields = {
        type: i.type,
        description: i.description,
        supplier: i.supplier,
        startDate: i.startDate,
        endDate: i.endDate,
        price: i.price,
        commissionRate: i.commissionRate,
        commissionFixed: i.commissionFixed,
        depositAmount: i.depositAmount,
        notes: i.notes,
        quoteItemId: i.id,
      };
      const source = i.sourceItemId ? await tx.bookingItem.findUnique({ where: { id: i.sourceItemId } }) : null;
      if (source && source.bookingId === booking.id && source.status !== "CANCELLED") {
        // Partió de una reserva que ya existía: si sigue por reservar, toma lo cotizado; si está confirmada, queda como está.
        if (source.status === "PENDING") {
          await tx.bookingItem.update({
            where: { id: source.id },
            data: { ...fields, balanceDue: source.balanceDue ?? suggestedBalanceDue(i.type, i.startDate ?? booking.startDate) },
          });
        } else {
          await tx.bookingItem.update({ where: { id: source.id }, data: { quoteItemId: i.id } });
        }
        continue;
      }
      const created = await tx.bookingItem.create({
        data: {
          bookingId: booking.id,
          ...fields,
          status: "PENDING",
          balanceDue: suggestedBalanceDue(i.type, i.startDate ?? booking.startDate),
          position: position++,
        },
      });
      if (travelerIds.length > 0) {
        await tx.bookingItemTraveler.createMany({ data: travelerIds.map((travelerId) => ({ bookingItemId: created.id, travelerId })) });
      }
    }
  });

  // El viaje pasa a Reservado cuando el agente confirma la primera reserva con el proveedor.
  await recalcBookingTotals(booking.id, userId);
  const byClient = via === "portal";
  if (byClient) {
    await notifyStaff({
      organizationId: booking.organizationId,
      userId: booking.agentId,
      title: `${booking.client.firstName} aceptó la cotización (${option.name})`,
      body: comment ?? quote.title,
      link: `/app/viajes/${booking.id}?tab=cotizaciones`,
    });
  } else {
    await notifyClient({
      organizationId: booking.organizationId,
      clientId: booking.clientId,
      title: `Quedó aceptada tu cotización (${option.name})`,
      body: quote.title,
      link: `/portal/cotizaciones/${quoteId}`,
    });
  }
  await db.task.create({
    data: {
      organizationId: booking.organizationId,
      assigneeId: booking.agentId ?? userId ?? null,
      bookingId: booking.id,
      clientId: booking.clientId,
      title: `Confirmar con los proveedores las reservas de "${option.name}"`,
      priority: "HIGH",
      dueDate: todayUTC(),
      automated: true,
    },
  });
  await logActivity({
    organizationId: booking.organizationId,
    clientId: booking.clientId,
    bookingId: booking.id,
    userId: userId ?? null,
    type: "quote",
    description: byClient ? `El cliente aceptó la cotización: ${option.name}` : `Cotización aceptada por ${via}: ${option.name}`,
  });
  return option;
}

/** Texto para explicar que una cotización venció. */
export function expiredMessage(quote: { validUntil: Date | null }) {
  return `Esta cotización venció el ${formatDate(quote.validUntil)}.`;
}
