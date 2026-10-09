"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ageOn, money, parseDateInput, todayUTC } from "@/lib/format";
import { commissionFromForm, paymentProgress, suggestedBalanceDue } from "@/lib/trips";
import { changeBookingStatus, confirmationData, nextBookingCode, recalcBookingTotals } from "@/lib/bookings";
import { logActivity } from "@/lib/events";
import { runEventWorkflows } from "@/lib/automations";
import { DESTINATION_LABEL, RESERVATION_STATUS_LABEL } from "@/lib/labels";
import type { ActionState } from "@/components/form-controls";
import type { BookingStatus, CommissionStatus, Destination, ItemType, ReservationStatus } from "@/generated/prisma/enums";

async function ownBooking(id: string) {
  const user = await requireUser();
  const booking = await db.booking.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!booking) throw new Error("Viaje no encontrado");
  return { user, booking };
}

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(formData: FormData, key: string) {
  const v = str(formData, key);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function bookingFields(formData: FormData) {
  return {
    destination: (str(formData, "destination") ?? "DISNEY_WORLD") as Destination,
    startDate: parseDateInput(formData.get("startDate")),
    endDate: parseDateInput(formData.get("endDate")),
    adults: Math.max(0, Math.round(num(formData, "adults") ?? 2)),
    children: Math.max(0, Math.round(num(formData, "children") ?? 0)),
    groupId: str(formData, "groupId"),
    currency: str(formData, "currency") ?? "USD",
    notes: str(formData, "notes"),
    clientNotes: str(formData, "clientNotes"),
  };
}

export async function createBooking(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const clientId = str(formData, "clientId");
  if (!clientId) return { error: "Elegí un cliente" };
  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: user.organizationId },
    include: { travelers: true },
  });
  if (!client) return { error: "Cliente no encontrado" };
  const fields = bookingFields(formData);
  if (fields.startDate && fields.endDate && fields.endDate < fields.startDate) {
    return { error: "La fecha de fin no puede ser anterior a la de inicio" };
  }
  const year = fields.startDate ? ` ${fields.startDate.getUTCFullYear()}` : "";
  const title = str(formData, "title") ?? `${DESTINATION_LABEL[fields.destination]}${year} — ${client.lastName}`;
  const status = (str(formData, "status") ?? "INQUIRY") as BookingStatus;

  const booking = await db.booking.create({
    data: {
      organizationId: user.organizationId,
      code: await nextBookingCode(user.organizationId),
      clientId,
      title,
      status,
      ...fields,
      agentId: user.id,
      // Por defecto viajan todos los viajeros cargados del cliente.
      travelers: { create: client.travelers.map((t) => ({ travelerId: t.id })) },
    },
  });
  await logActivity({
    organizationId: user.organizationId,
    clientId,
    bookingId: booking.id,
    userId: user.id,
    type: "created",
    description: `Viaje ${booking.code} creado`,
  });
  await runEventWorkflows({ organizationId: user.organizationId, trigger: "BOOKING_CREATED", clientId, bookingId: booking.id });
  redirect(`/app/viajes/${booking.id}`);
}

export async function updateBooking(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, booking } = await ownBooking(id);
  const fields = bookingFields(formData);
  if (fields.startDate && fields.endDate && fields.endDate < fields.startDate) {
    return { error: "La fecha de fin no puede ser anterior a la de inicio" };
  }
  await db.booking.update({
    where: { id },
    data: { ...fields, title: str(formData, "title") ?? booking.title },
  });
  const status = str(formData, "status") as BookingStatus | null;
  if (status && status !== booking.status) await changeBookingStatus({ bookingId: id, status, userId: user.id });
  await logActivity({ organizationId: user.organizationId, clientId: booking.clientId, bookingId: id, userId: user.id, type: "updated", description: "Viaje actualizado" });
  redirect(`/app/viajes/${id}`);
}

export async function setBookingStatus(id: string, status: BookingStatus) {
  const { user } = await ownBooking(id);
  await changeBookingStatus({ bookingId: id, status, userId: user.id });
  revalidatePath("/app/viajes");
  revalidatePath(`/app/viajes/${id}`);
}

export async function setBookingStatusForm(id: string, formData: FormData) {
  const status = String(formData.get("status")) as BookingStatus;
  await setBookingStatus(id, status);
}

export async function cancelBooking(id: string, formData: FormData) {
  const { user, booking } = await ownBooking(id);
  await db.booking.update({ where: { id }, data: { cancelReason: str(formData, "cancelReason") } });
  await changeBookingStatus({ bookingId: id, status: "CANCELLED", userId: user.id });
  revalidatePath(`/app/viajes/${booking.id}`);
}

export async function deleteBooking(id: string) {
  await ownBooking(id);
  await db.booking.delete({ where: { id } });
  redirect("/app/viajes");
}

// ─── Reservas del viaje (paquete Disney, tickets, auto, hotel…) ──────────────

function itemFields(formData: FormData) {
  const status = (str(formData, "status") ?? "PENDING") as ReservationStatus;
  const commissionStatus = (str(formData, "commissionStatus") ?? "PENDING") as CommissionStatus;
  const saleDate = parseDateInput(formData.get("saleDate"));
  return {
    type: (str(formData, "type") ?? "OTHER") as ItemType,
    status,
    description: str(formData, "description") ?? "",
    supplier: str(formData, "supplier"),
    confirmationNumber: str(formData, "confirmationNumber"),
    startDate: parseDateInput(formData.get("startDate")),
    endDate: parseDateInput(formData.get("endDate")),
    notes: str(formData, "notes"),
    price: num(formData, "price") ?? 0,
    depositAmount: num(formData, "depositAmount"),
    balanceDue: parseDateInput(formData.get("balanceDue")),
    // Al confirmarla con el proveedor queda registrada la venta (para la planilla de comisiones).
    saleDate: saleDate ?? (status === "CONFIRMED" ? todayUTC() : null),
    ...commissionFromForm(formData),
    commissionStatus,
    commissionPaidAt: commissionStatus === "PAID" ? (parseDateInput(formData.get("commissionPaidAt")) ?? todayUTC()) : null,
    commissionPaidAmount: commissionStatus === "PAID" ? num(formData, "commissionPaidAmount") : null,
    commissionNotes: str(formData, "commissionNotes"),
  };
}

async function ownItem(itemId: string) {
  const user = await requireUser();
  const item = await db.bookingItem.findFirst({
    where: { id: itemId, booking: { organizationId: user.organizationId } },
    include: { booking: { select: { clientId: true, startDate: true, currency: true } } },
  });
  if (!item) throw new Error("Reserva no encontrada");
  return { user, item };
}

async function afterItemChange(bookingId: string, userId: string) {
  await recalcBookingTotals(bookingId, userId);
  revalidatePath(`/app/viajes/${bookingId}`);
}

export async function addBookingItem(bookingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, booking } = await ownBooking(bookingId);
  const data = itemFields(formData);
  if (!data.description) return { error: "Describí la reserva" };
  data.balanceDue ??= suggestedBalanceDue(data.type, data.startDate ?? booking.startDate);
  const position = await db.bookingItem.count({ where: { bookingId } });
  await db.bookingItem.create({ data: { bookingId, ...data, position } });
  await logActivity({ organizationId: user.organizationId, clientId: booking.clientId, bookingId, userId: user.id, type: "item", description: `Reserva agregada: ${data.description}` });
  await afterItemChange(bookingId, user.id);
  return { ok: "Reserva agregada" };
}

export async function updateBookingItem(itemId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, item } = await ownItem(itemId);
  const data = itemFields(formData);
  if (!data.description) return { error: "Describí la reserva" };
  data.balanceDue ??= suggestedBalanceDue(data.type, data.startDate ?? item.booking.startDate);
  await db.bookingItem.update({ where: { id: itemId }, data });
  if (item.status !== data.status) {
    await logActivity({
      organizationId: user.organizationId,
      clientId: item.booking.clientId,
      bookingId: item.bookingId,
      userId: user.id,
      type: "item",
      description: `${data.description}: ${RESERVATION_STATUS_LABEL[item.status]} → ${RESERVATION_STATUS_LABEL[data.status]}`,
    });
  }
  await afterItemChange(item.bookingId, user.id);
  return { ok: "Reserva actualizada" };
}

/** Accesos rápidos desde la lista de reservas del viaje. */
/** Confirmar o cancelar en un clic. Al confirmar se pueden cargar el n° de confirmación y las fechas. */
export async function quickItemAction(itemId: string, action: "confirm" | "cancel", formData?: FormData) {
  const { user, item } = await ownItem(itemId);
  const data: { status: ReservationStatus; saleDate?: Date; confirmationNumber?: string; startDate?: Date; endDate?: Date } =
    action === "confirm" ? confirmationData(item) : { status: "CANCELLED" };
  if (action === "confirm" && formData) {
    const confirmationNumber = str(formData, "confirmationNumber");
    const startDate = parseDateInput(formData.get("startDate"));
    const endDate = parseDateInput(formData.get("endDate"));
    if (confirmationNumber) data.confirmationNumber = confirmationNumber;
    if (startDate) data.startDate = startDate;
    if (endDate && (!startDate || endDate >= startDate)) data.endDate = endDate;
  }
  await db.bookingItem.update({ where: { id: itemId }, data });
  const label = action === "confirm" ? "confirmada" : "cancelada";
  await logActivity({ organizationId: user.organizationId, clientId: item.booking.clientId, bookingId: item.bookingId, userId: user.id, type: "item", description: `Reserva ${label}: ${item.description}` });
  await afterItemChange(item.bookingId, user.id);
}

// ─── Pagos de la reserva (depósito, cuotas libres, saldo) ────────────────────

export async function addReservationPayment(itemId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, item } = await ownItem(itemId);
  const amount = num(formData, "amount");
  if (!amount || amount <= 0) return { error: "Ingresá el monto pagado" };
  const paidAt = parseDateInput(formData.get("paidAt")) ?? todayUTC();
  await db.reservationPayment.create({ data: { bookingItemId: itemId, amount, paidAt, note: str(formData, "note") } });
  await logActivity({
    organizationId: user.organizationId,
    clientId: item.booking.clientId,
    bookingId: item.bookingId,
    userId: user.id,
    type: "payment",
    description: `Pago de ${money(amount, item.booking.currency)} en ${item.description}`,
  });
  await afterItemChange(item.bookingId, user.id);
  return { ok: "Pago registrado" };
}

/** Registra un pago por todo lo que falta. */
export async function payReservationBalance(itemId: string) {
  const { user, item } = await ownItem(itemId);
  const { remaining } = paymentProgress(item);
  if (remaining <= 0) return;
  await db.reservationPayment.create({ data: { bookingItemId: itemId, amount: remaining, paidAt: todayUTC(), note: "Saldo" } });
  await logActivity({
    organizationId: user.organizationId,
    clientId: item.booking.clientId,
    bookingId: item.bookingId,
    userId: user.id,
    type: "payment",
    description: `Saldo pagado (${money(remaining, item.booking.currency)}): ${item.description}`,
  });
  await afterItemChange(item.bookingId, user.id);
}

export async function deleteReservationPayment(paymentId: string) {
  const user = await requireUser();
  const payment = await db.reservationPayment.findFirst({
    where: { id: paymentId, bookingItem: { booking: { organizationId: user.organizationId } } },
    include: { bookingItem: { select: { bookingId: true } } },
  });
  if (!payment) throw new Error("Pago no encontrado");
  await db.reservationPayment.delete({ where: { id: paymentId } });
  await afterItemChange(payment.bookingItem.bookingId, user.id);
}

export async function deleteBookingItem(itemId: string) {
  const { user, item } = await ownItem(itemId);
  await db.bookingItem.delete({ where: { id: itemId } });
  await logActivity({ organizationId: user.organizationId, clientId: item.booking.clientId, bookingId: item.bookingId, userId: user.id, type: "item", description: `Reserva eliminada: ${item.description}` });
  await afterItemChange(item.bookingId, user.id);
}

// ─── Vuelos del viaje (dato de referencia: los agentes no los venden) ────────

export async function saveTripFlights(bookingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await ownBooking(bookingId);
  for (const [prefix, direction] of [["out", "OUTBOUND"], ["back", "RETURN"]] as const) {
    const leg = {
      date: parseDateInput(formData.get(`${prefix}Date`)),
      time: str(formData, `${prefix}Time`),
      airline: str(formData, `${prefix}Airline`),
      flightNumber: str(formData, `${prefix}Number`)?.toUpperCase() ?? null,
    };
    const where = { bookingId_direction: { bookingId, direction } };
    if (!leg.date && !leg.time && !leg.airline && !leg.flightNumber) {
      await db.flightLeg.deleteMany({ where: { bookingId, direction } });
    } else {
      await db.flightLeg.upsert({ where, create: { bookingId, direction, ...leg }, update: leg });
    }
  }
  revalidatePath(`/app/viajes/${bookingId}`);
  return { ok: "Vuelos guardados" };
}

// ─── Viajeros de la reserva ──────────────────────────────────────────────────

export async function setBookingTravelers(bookingId: string, formData: FormData) {
  const { booking } = await ownBooking(bookingId);
  const ids = formData.getAll("travelerIds").map(String);
  const valid = await db.traveler.findMany({ where: { id: { in: ids }, clientId: booking.clientId }, select: { id: true, birthDate: true } });
  await db.bookingTraveler.deleteMany({ where: { bookingId } });
  await db.bookingTraveler.createMany({ data: valid.map((t) => ({ bookingId, travelerId: t.id })) });
  // Actualiza adultos/menores según las edades al viajar (menor = menos de 18).
  const at = booking.startDate ?? new Date();
  const withAge = valid.filter((t) => t.birthDate);
  if (withAge.length === valid.length && valid.length > 0) {
    const children = withAge.filter((t) => (ageOn(t.birthDate, at) ?? 99) < 18).length;
    await db.booking.update({ where: { id: bookingId }, data: { adults: valid.length - children, children } });
  }
  revalidatePath(`/app/viajes/${bookingId}`);
}

// ─── Notas ───────────────────────────────────────────────────────────────────

/** Notas libres del viaje (internas): se editan desde el resumen y la IA las usa para el itinerario. */
export async function saveTripNotes(bookingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await ownBooking(bookingId);
  await db.booking.update({ where: { id: bookingId }, data: { notes: str(formData, "notes") } });
  revalidatePath(`/app/viajes/${bookingId}`);
  return { ok: "Notas guardadas" };
}
