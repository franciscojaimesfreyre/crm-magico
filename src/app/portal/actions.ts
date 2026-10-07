"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  endPortalSession,
  hashPassword,
  requireClientAccount,
  startPortalSession,
  verifyPassword,
} from "@/lib/auth";
import { parseDateInput, todayUTC } from "@/lib/format";
import { nextBookingCode, recalcBookingTotals } from "@/lib/bookings";
import { logActivity, notifyStaff } from "@/lib/events";
import { runEventWorkflows } from "@/lib/automations";
import { loadThread } from "@/lib/messages";
import { splitList } from "@/lib/clients";
import { DESTINATION_LABEL } from "@/lib/labels";
import type { ActionState } from "@/components/form-controls";
import type { Destination, TripPace } from "@/generated/prisma/enums";

// ─── Acceso ──────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  code: z.string().trim().toUpperCase().length(6, "El código tiene 6 caracteres"),
  email: z.email("Email inválido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function registerPortal(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = RegisterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { code, email, password } = parsed.data;
  const client = await db.client.findUnique({ where: { inviteCode: code }, include: { account: true } });
  if (!client) return { error: "No encontramos ese código. Revisalo o pedile uno nuevo a tu agente." };
  if (client.account) return { error: "Este código ya fue usado. Ingresá con tu email y contraseña." };
  if (await db.clientAccount.findUnique({ where: { email } })) return { error: "Ya hay una cuenta con ese email." };
  const account = await db.clientAccount.create({
    data: { clientId: client.id, email, passwordHash: await hashPassword(password), lastLoginAt: new Date() },
  });
  if (!client.email) await db.client.update({ where: { id: client.id }, data: { email } });
  await notifyStaff({
    organizationId: client.organizationId,
    userId: client.ownerId,
    title: `${client.firstName} ${client.lastName} activó su portal`,
    link: `/app/clientes/${client.id}`,
  });
  await logActivity({ organizationId: client.organizationId, clientId: client.id, type: "portal", description: "El cliente activó su portal" });
  await startPortalSession(account.id);
  redirect("/portal");
}

export async function loginPortal(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const account = await db.clientAccount.findUnique({ where: { email } });
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    return { error: "Email o contraseña incorrectos" };
  }
  await db.clientAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
  await startPortalSession(account.id);
  redirect("/portal");
}

export async function logoutPortal() {
  await endPortalSession();
  redirect("/portal/login");
}

// ─── Cotizaciones ────────────────────────────────────────────────────────────

async function ownQuote(quoteId: string) {
  const account = await requireClientAccount();
  const quote = await db.quote.findFirst({
    where: { id: quoteId, booking: { clientId: account.clientId }, status: { in: ["SENT", "ACCEPTED", "REJECTED"] } },
    include: { booking: true, options: { include: { items: { orderBy: { position: "asc" } } } } },
  });
  if (!quote) throw new Error("Cotización no encontrada");
  return { account, quote };
}

export async function acceptQuote(quoteId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { account, quote } = await ownQuote(quoteId);
  if (quote.status !== "SENT") return { error: "Esta cotización ya fue respondida." };
  const optionId = String(formData.get("optionId") ?? "");
  const option = quote.options.find((o) => o.id === optionId);
  if (!option) return { error: "Elegí una opción" };
  const comment = String(formData.get("comment") ?? "").trim() || null;

  await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: { status: "ACCEPTED", acceptedOptionId: option.id, respondedAt: new Date(), clientComment: comment },
    });
    // Las otras cotizaciones enviadas del mismo viaje quedan vencidas.
    await tx.quote.updateMany({ where: { bookingId: quote.bookingId, id: { not: quoteId }, status: "SENT" }, data: { status: "EXPIRED" } });
    // Las reservas de la opción elegida entran "a reservar" y reemplazan a las que estaban pendientes.
    // Las ya confirmadas con el proveedor no se tocan.
    await tx.bookingItem.deleteMany({ where: { bookingId: quote.bookingId, status: "PENDING", statementItems: { none: {} } } });
    const offset = await tx.bookingItem.count({ where: { bookingId: quote.bookingId } });
    await tx.bookingItem.createMany({
      data: option.items.map((i, idx) => ({
        bookingId: quote.bookingId,
        type: i.type,
        description: i.description,
        supplier: i.supplier,
        startDate: i.startDate,
        endDate: i.endDate,
        price: i.price,
        commissionRate: i.commissionRate,
        commissionFixed: i.commissionFixed,
        status: "PENDING" as const,
        position: offset + idx,
      })),
    });
  });
  // El viaje pasa a Reservado cuando el agente confirma la primera reserva con el proveedor.
  await recalcBookingTotals(quote.bookingId);
  await notifyStaff({
    organizationId: quote.booking.organizationId,
    userId: quote.booking.agentId,
    title: `🎉 ${account.client.firstName} aceptó la cotización (${option.name})`,
    body: comment ?? quote.title,
    link: `/app/viajes/${quote.bookingId}?tab=cotizaciones`,
  });
  await db.task.create({
    data: {
      organizationId: quote.booking.organizationId,
      assigneeId: quote.booking.agentId,
      bookingId: quote.bookingId,
      clientId: quote.booking.clientId,
      title: `Confirmar con los proveedores las reservas de "${option.name}"`,
      priority: "HIGH",
      dueDate: todayUTC(),
      automated: true,
    },
  });
  await logActivity({ organizationId: quote.booking.organizationId, clientId: quote.booking.clientId, bookingId: quote.bookingId, type: "quote", description: `El cliente aceptó la cotización: ${option.name}` });
  revalidatePath(`/portal/cotizaciones/${quoteId}`);
  // La página se revalida y muestra el estado "aceptada"; no hace falta un segundo mensaje.
  return {};
}

export async function rejectQuote(quoteId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { account, quote } = await ownQuote(quoteId);
  if (quote.status !== "SENT") return { error: "Esta cotización ya fue respondida." };
  const comment = String(formData.get("comment") ?? "").trim() || null;
  await db.quote.update({ where: { id: quoteId }, data: { status: "REJECTED", respondedAt: new Date(), clientComment: comment } });
  await notifyStaff({
    organizationId: quote.booking.organizationId,
    userId: quote.booking.agentId,
    title: `${account.client.firstName} no aceptó la cotización`,
    body: comment ?? quote.title,
    link: `/app/viajes/${quote.bookingId}?tab=cotizaciones`,
  });
  await logActivity({ organizationId: quote.booking.organizationId, clientId: quote.booking.clientId, bookingId: quote.bookingId, type: "quote", description: `El cliente rechazó la cotización${comment ? `: ${comment}` : ""}` });
  revalidatePath(`/portal/cotizaciones/${quoteId}`);
  return {};
}

// ─── Mensajes ────────────────────────────────────────────────────────────────

async function ownThread(bookingId: string | null) {
  const account = await requireClientAccount();
  if (bookingId) {
    const booking = await db.booking.findFirst({ where: { id: bookingId, clientId: account.clientId } });
    if (!booking) throw new Error("Viaje no encontrado");
  }
  return account;
}

export async function sendClientMessage(bookingId: string | null, body: string) {
  const account = await ownThread(bookingId);
  const text = body.trim().slice(0, 5000);
  if (text) {
    await db.message.create({ data: { clientId: account.clientId, bookingId, senderType: "CLIENT", body: text } });
    const booking = bookingId ? await db.booking.findUnique({ where: { id: bookingId } }) : null;
    await notifyStaff({
      organizationId: account.client.organizationId,
      userId: booking?.agentId ?? account.client.ownerId,
      title: `Mensaje de ${account.client.firstName} ${account.client.lastName}`,
      body: text.slice(0, 140),
      link: `/app/mensajes?c=${account.clientId}${bookingId ? `&b=${bookingId}` : ""}`,
    });
  }
  return readClientThread(bookingId);
}

export async function readClientThread(bookingId: string | null) {
  const account = await ownThread(bookingId);
  await db.message.updateMany({
    where: { clientId: account.clientId, bookingId, senderType: { not: "CLIENT" }, readByClientAt: null },
    data: { readByClientAt: new Date() },
  });
  return loadThread(account.clientId, bookingId);
}

// ─── Pedido de nuevo viaje ───────────────────────────────────────────────────

export async function requestTrip(_: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireClientAccount();
  const client = account.client;
  const destination = String(formData.get("destination") ?? "DISNEY_WORLD") as Destination;
  const startDate = parseDateInput(formData.get("startDate"));
  const endDate = parseDateInput(formData.get("endDate"));
  const adults = Math.max(1, Number(formData.get("adults") || 2));
  const children = Math.max(0, Number(formData.get("children") || 0));
  const notes = String(formData.get("notes") ?? "").trim();
  const booking = await db.booking.create({
    data: {
      organizationId: client.organizationId,
      code: await nextBookingCode(client.organizationId),
      clientId: client.id,
      agentId: client.ownerId,
      title: `${DESTINATION_LABEL[destination]}${startDate ? ` ${startDate.getUTCFullYear()}` : ""} — ${client.lastName}`,
      destination,
      status: "INQUIRY",
      startDate,
      endDate,
      adults,
      children,
      clientNotes: notes || null,
      travelers: { create: (await db.traveler.findMany({ where: { clientId: client.id } })).map((t) => ({ travelerId: t.id })) },
    },
  });
  if (notes) {
    await db.message.create({ data: { clientId: client.id, bookingId: booking.id, senderType: "CLIENT", body: notes } });
  }
  await notifyStaff({
    organizationId: client.organizationId,
    userId: client.ownerId,
    title: `Nuevo pedido de viaje de ${client.firstName} ${client.lastName}`,
    body: DESTINATION_LABEL[destination],
    link: `/app/viajes/${booking.id}`,
  });
  await logActivity({ organizationId: client.organizationId, clientId: client.id, bookingId: booking.id, type: "created", description: "Pedido de viaje desde el portal" });
  await runEventWorkflows({ organizationId: client.organizationId, trigger: "BOOKING_CREATED", clientId: client.id, bookingId: booking.id });
  redirect(`/portal/viajes/${booking.id}`);
}

// ─── Perfil y preferencias ───────────────────────────────────────────────────

export async function updatePortalProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireClientAccount();
  const opt = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  await db.client.update({
    where: { id: account.clientId },
    data: {
      phone: opt("phone"),
      pace: (opt("pace") as TripPace | null) ?? undefined,
      interests: [...formData.getAll("interests").map(String), ...splitList(formData.get("otherInterests"))],
      dietaryNotes: opt("dietaryNotes"),
      accessibilityNotes: opt("accessibilityNotes"),
      preferenceNotes: opt("preferenceNotes"),
    },
  });
  // Viajeros: altura y fecha de nacimiento (claves para elegir atracciones).
  const travelers = await db.traveler.findMany({ where: { clientId: account.clientId } });
  for (const t of travelers) {
    const height = Number(formData.get(`height-${t.id}`));
    await db.traveler.update({
      where: { id: t.id },
      data: {
        birthDate: parseDateInput(formData.get(`birth-${t.id}`)) ?? t.birthDate,
        heightCm: Number.isFinite(height) && height > 0 ? Math.round(height) : t.heightCm,
      },
    });
  }
  const newName = opt("newTravelerName");
  if (newName) {
    const height = Number(formData.get("newTravelerHeight"));
    await db.traveler.create({
      data: {
        clientId: account.clientId,
        firstName: newName,
        birthDate: parseDateInput(formData.get("newTravelerBirth")),
        heightCm: Number.isFinite(height) && height > 0 ? Math.round(height) : null,
      },
    });
  }
  await logActivity({ organizationId: account.client.organizationId, clientId: account.clientId, type: "portal", description: "El cliente actualizó sus preferencias desde el portal" });
  revalidatePath("/portal/perfil");
  return { ok: "¡Gracias! Tu agente va a usar esta información para planificar mejor." };
}

export async function markPortalNotificationsRead() {
  const account = await requireClientAccount();
  await db.notification.updateMany({ where: { clientAccountId: account.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/portal", "layout");
}
