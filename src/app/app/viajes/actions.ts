"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ageOn, money, parseDateInput, todayUTC } from "@/lib/format";
import { commissionFromForm, paymentProgress, suggestedBalanceDue } from "@/lib/trips";
import { changeBookingStatus, confirmationData, nextBookingCode, recalcBookingTotals } from "@/lib/bookings";
import { logActivity, notifyClient } from "@/lib/events";
import { incomingFiles, type StoredFile } from "@/lib/incoming-files";
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
    currency: str(formData, "currency"),
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
      currency: fields.currency ?? user.organization.defaultCurrency,
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
    data: { ...fields, currency: fields.currency ?? booking.currency, title: str(formData, "title") ?? booking.title },
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
    taxAmount: num(formData, "taxAmount"),
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

/** Valida lo que llega del formulario de una reserva antes de guardarla. */
function checkItem(data: ReturnType<typeof itemFields>) {
  if (!data.description) return "Describí la reserva";
  if (data.taxAmount !== null && data.taxAmount > data.price) return "El tax no puede superar el importe";
  if (data.startDate && data.endDate && data.endDate < data.startDate) return "La fecha de fin no puede ser anterior a la de inicio";
  return null;
}

type NewTraveler = { firstName: string; lastName: string | null; birthDate: Date | null; heightCm: number | null; relationship: string | null };

/** Viajeros marcados en el formulario de una reserva y los nuevos que se cargaron ahí mismo. */
async function travelersFromForm(formData: FormData, clientId: string, required: boolean) {
  const ids = formData.getAll("travelerIds").map(String);
  const existing = await db.traveler.findMany({ where: { id: { in: ids }, clientId }, select: { id: true } });
  const all = (key: string) => formData.getAll(key).map((v) => String(v).trim());
  const lastNames = all("newLastName");
  const births = all("newBirthDate");
  const heights = all("newHeightCm");
  const relationships = all("newRelationship");
  const fresh: NewTraveler[] = all("newFirstName").map((firstName, i) => {
    const height = Math.round(Number(heights[i]));
    return {
      firstName,
      lastName: lastNames[i] || null,
      birthDate: parseDateInput(births[i] ?? null),
      heightCm: heights[i] && height > 0 ? height : null,
      relationship: relationships[i] || null,
    };
  });
  if (fresh.some((t) => !t.firstName)) return { error: "Completá el nombre de cada viajero nuevo" };
  if (required && existing.length + fresh.length === 0) return { error: "Elegí los viajeros incluidos en la reserva (o agregá uno)" };
  return { existing: existing.map((t) => t.id), fresh };
}

/**
 * Guarda los viajeros de la reserva: crea los nuevos en el cliente y suma todos al viaje
 * (si no estaban), y reemplaza los de la reserva.
 */
async function saveItemTravelers(itemId: string, booking: { id: string; clientId: string }, picked: { existing: string[]; fresh: NewTraveler[] }) {
  const created = await Promise.all(picked.fresh.map((t) => db.traveler.create({ data: { clientId: booking.clientId, ...t }, select: { id: true } })));
  const ids = [...picked.existing, ...created.map((t) => t.id)];
  await db.bookingItemTraveler.deleteMany({ where: { bookingItemId: itemId } });
  await db.bookingItemTraveler.createMany({ data: ids.map((travelerId) => ({ bookingItemId: itemId, travelerId })) });
  const result = await db.bookingTraveler.createMany({ data: ids.map((travelerId) => ({ bookingId: booking.id, travelerId })), skipDuplicates: true });
  if (result.count > 0) await syncPassengerCounts(booking.id);
  return created.length;
}

/** Adjunta a la reserva los archivos subidos con su formulario (también quedan en Documentos del viaje). */
async function saveItemDocuments(
  files: StoredFile[],
  formData: FormData,
  ctx: { organizationId: string; userId: string; bookingId: string; clientId: string; itemId: string; description: string },
) {
  if (files.length === 0) return;
  const visibleToClient = formData.get("docsVisibleToClient") === "on";
  await db.document.createMany({
    data: files.map((f) => ({
      organizationId: ctx.organizationId,
      bookingId: ctx.bookingId,
      bookingItemId: ctx.itemId,
      clientId: ctx.clientId,
      name: f.name,
      storageKey: f.stored.key,
      size: f.stored.size,
      mimeType: f.stored.mimeType,
      visibleToClient,
      uploadedById: ctx.userId,
    })),
  });
  const names = files.map((f) => f.name).join(", ");
  if (visibleToClient) {
    await notifyClient({
      organizationId: ctx.organizationId,
      clientId: ctx.clientId,
      title: files.length === 1 ? "Hay un documento nuevo en tu viaje" : "Hay documentos nuevos en tu viaje",
      body: names,
      link: `/portal/viajes/${ctx.bookingId}?tab=documentos`,
    });
  }
  await logActivity({
    organizationId: ctx.organizationId,
    clientId: ctx.clientId,
    bookingId: ctx.bookingId,
    userId: ctx.userId,
    type: "document",
    description: `${files.length === 1 ? "Documento agregado" : "Documentos agregados"} a ${ctx.description}: ${names}`,
  });
}

async function afterItemChange(bookingId: string, userId: string) {
  await recalcBookingTotals(bookingId, userId);
  revalidatePath(`/app/viajes/${bookingId}`);
}

export async function addBookingItem(bookingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, booking } = await ownBooking(bookingId);
  // Una reserva nueva arranca con la comisión pendiente: el cobro se registra después, al editarla.
  const data = { ...itemFields(formData), commissionStatus: "PENDING" as const, commissionPaidAt: null, commissionPaidAmount: null };
  const invalid = checkItem(data);
  if (invalid) return { error: invalid };
  const travelers = await travelersFromForm(formData, booking.clientId, true);
  if ("error" in travelers) return { error: travelers.error };
  const files = await incomingFiles(formData, user.organizationId);
  if ("error" in files) return { error: files.error };
  data.balanceDue ??= suggestedBalanceDue(data.type, data.startDate ?? booking.startDate);
  const position = await db.bookingItem.count({ where: { bookingId } });
  const item = await db.bookingItem.create({ data: { bookingId, ...data, position } });
  const added = await saveItemTravelers(item.id, booking, travelers);
  await logActivity({ organizationId: user.organizationId, clientId: booking.clientId, bookingId, userId: user.id, type: "item", description: `Reserva agregada: ${data.description}` });
  await saveItemDocuments(files, formData, { organizationId: user.organizationId, userId: user.id, bookingId, clientId: booking.clientId, itemId: item.id, description: data.description });
  await afterItemChange(bookingId, user.id);
  return { ok: added > 0 ? `Reserva agregada. ${added === 1 ? "El viajero nuevo quedó" : "Los viajeros nuevos quedaron"} en el viaje.` : "Reserva agregada" };
}

export async function updateBookingItem(itemId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, item } = await ownItem(itemId);
  const data = itemFields(formData);
  const invalid = checkItem(data);
  if (invalid) return { error: invalid };
  const travelers = await travelersFromForm(formData, item.booking.clientId, false);
  if ("error" in travelers) return { error: travelers.error };
  const files = await incomingFiles(formData, user.organizationId);
  if ("error" in files) return { error: files.error };
  data.balanceDue ??= suggestedBalanceDue(data.type, data.startDate ?? item.booking.startDate);
  await db.bookingItem.update({ where: { id: itemId }, data });
  await saveItemTravelers(itemId, { id: item.bookingId, clientId: item.booking.clientId }, travelers);
  await saveItemDocuments(files, formData, {
    organizationId: user.organizationId,
    userId: user.id,
    bookingId: item.bookingId,
    clientId: item.booking.clientId,
    itemId,
    description: data.description,
  });
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
  const valid = await db.traveler.findMany({ where: { id: { in: ids }, clientId: booking.clientId }, select: { id: true } });
  await db.bookingTraveler.deleteMany({ where: { bookingId } });
  await db.bookingTraveler.createMany({ data: valid.map((t) => ({ bookingId, travelerId: t.id })) });
  await syncPassengerCounts(booking.id);
  revalidatePath(`/app/viajes/${bookingId}`);
}

/** Actualiza adultos/menores según las edades al viajar (menor = menos de 18), si todos tienen fecha de nacimiento. */
async function syncPassengerCounts(bookingId: string) {
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { travelers: { include: { traveler: { select: { birthDate: true } } } } } });
  const travelers = booking.travelers.map((t) => t.traveler);
  if (travelers.length === 0 || travelers.some((t) => !t.birthDate)) return;
  const at = booking.startDate ?? new Date();
  const children = travelers.filter((t) => (ageOn(t.birthDate, at) ?? 99) < 18).length;
  await db.booking.update({ where: { id: bookingId }, data: { adults: travelers.length - children, children } });
}

// ─── Notas ───────────────────────────────────────────────────────────────────

/** Notas libres del viaje (internas): se editan desde el resumen y la IA las usa para el itinerario. */
export async function saveTripNotes(bookingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await ownBooking(bookingId);
  await db.booking.update({ where: { id: bookingId }, data: { notes: str(formData, "notes") } });
  revalidatePath(`/app/viajes/${bookingId}`);
  return { ok: "Notas guardadas" };
}
