"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import { changeBookingStatus } from "@/lib/bookings";
import { logActivity, notifyClient } from "@/lib/events";
import { sendEmail } from "@/lib/email";
import { AIError, draftQuoteMessage } from "@/lib/ai";
import type { ActionState } from "@/components/form-controls";
import type { ItemType } from "@/generated/prisma/enums";

async function ownQuote(quoteId: string) {
  const user = await requireUser();
  const quote = await db.quote.findFirst({
    where: { id: quoteId, booking: { organizationId: user.organizationId } },
    include: { booking: { include: { client: true } } },
  });
  if (!quote) throw new Error("Cotización no encontrada");
  return { user, quote };
}

function path(bookingId: string) {
  return `/app/viajes/${bookingId}`;
}

export async function createQuote(bookingId: string) {
  const user = await requireUser();
  const booking = await db.booking.findFirst({
    where: { id: bookingId, organizationId: user.organizationId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!booking) throw new Error("Viaje no encontrado");
  const count = await db.quote.count({ where: { bookingId } });
  await db.quote.create({
    data: {
      bookingId,
      title: count === 0 ? `Cotización — ${booking.title}` : `Cotización ${count + 1} — ${booking.title}`,
      options: {
        create: {
          name: "Opción 1",
          position: 0,
          // Si la reserva ya tiene servicios, se usan como punto de partida.
          items: {
            create: booking.items.map((i, idx) => ({
              type: i.type,
              description: i.description,
              supplier: i.supplier,
              startDate: i.startDate,
              endDate: i.endDate,
              price: i.price,
              commissionRate: i.commissionRate,
              position: idx,
            })),
          },
        },
      },
    },
  });
  revalidatePath(path(bookingId));
}

export async function updateQuote(quoteId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { quote } = await ownQuote(quoteId);
  await db.quote.update({
    where: { id: quoteId },
    data: {
      title: String(formData.get("title") ?? quote.title).trim() || quote.title,
      message: String(formData.get("message") ?? "").trim() || null,
      validUntil: parseDateInput(formData.get("validUntil")),
    },
  });
  revalidatePath(path(quote.bookingId));
  return { ok: "Cotización guardada" };
}

export async function deleteQuote(quoteId: string) {
  const { quote } = await ownQuote(quoteId);
  await db.quote.delete({ where: { id: quoteId } });
  revalidatePath(path(quote.bookingId));
}

export async function addQuoteOption(quoteId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { quote } = await ownQuote(quoteId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Poné un nombre a la opción" };
  const position = await db.quoteOption.count({ where: { quoteId } });
  await db.quoteOption.create({
    data: { quoteId, name, description: String(formData.get("description") ?? "").trim() || null, position },
  });
  revalidatePath(path(quote.bookingId));
  return { ok: "Opción agregada" };
}

export async function deleteQuoteOption(optionId: string) {
  const user = await requireUser();
  const option = await db.quoteOption.findFirst({
    where: { id: optionId, quote: { booking: { organizationId: user.organizationId } } },
    include: { quote: true },
  });
  if (!option) return;
  await db.quoteOption.delete({ where: { id: optionId } });
  revalidatePath(path(option.quote.bookingId));
}

export async function addQuoteItem(optionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const option = await db.quoteOption.findFirst({
    where: { id: optionId, quote: { booking: { organizationId: user.organizationId } } },
    include: { quote: true },
  });
  if (!option) return { error: "Opción no encontrada" };
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Describí el servicio" };
  const price = Number(String(formData.get("price") ?? "0").replace(",", "."));
  const rateRaw = String(formData.get("commissionRate") ?? "").trim();
  const position = await db.quoteItem.count({ where: { optionId } });
  await db.quoteItem.create({
    data: {
      optionId,
      type: String(formData.get("type") ?? "OTHER") as ItemType,
      description,
      supplier: String(formData.get("supplier") ?? "").trim() || null,
      startDate: parseDateInput(formData.get("startDate")),
      endDate: parseDateInput(formData.get("endDate")),
      price: Number.isFinite(price) ? price : 0,
      commissionRate: rateRaw ? Number(rateRaw.replace(",", ".")) : null,
      position,
    },
  });
  revalidatePath(path(option.quote.bookingId));
  return { ok: "Servicio agregado" };
}

export async function deleteQuoteItem(itemId: string) {
  const user = await requireUser();
  const item = await db.quoteItem.findFirst({
    where: { id: itemId, option: { quote: { booking: { organizationId: user.organizationId } } } },
    include: { option: { include: { quote: true } } },
  });
  if (!item) return;
  await db.quoteItem.delete({ where: { id: itemId } });
  revalidatePath(path(item.option.quote.bookingId));
}

/** Publica la cotización en el portal, avisa al cliente y pasa la reserva a "Cotizado". */
export async function sendQuote(quoteId: string, _state?: ActionState, _formData?: FormData): Promise<ActionState> {
  const { user, quote } = await ownQuote(quoteId);
  const options = await db.quoteOption.findMany({ where: { quoteId }, include: { items: true } });
  if (options.length === 0 || options.every((o) => o.items.length === 0)) {
    return { error: "Agregá al menos un servicio a alguna opción antes de enviar" };
  }
  await db.quote.update({ where: { id: quoteId }, data: { status: "SENT", sentAt: new Date() } });
  if (quote.booking.status === "INQUIRY") {
    await changeBookingStatus({ bookingId: quote.bookingId, status: "QUOTED", userId: user.id });
  }
  const client = quote.booking.client;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const link = `/portal/cotizaciones/${quoteId}`;
  await notifyClient({
    organizationId: user.organizationId,
    clientId: client.id,
    title: `Nueva cotización de ${user.name}`,
    body: quote.title,
    link,
  });
  await db.message.create({
    data: {
      clientId: client.id,
      bookingId: quote.bookingId,
      senderType: "SYSTEM",
      body: `${user.name} te envió una cotización: "${quote.title}". Podés verla y responder desde el portal.`,
    },
  });
  let emailNote = "";
  if (client.email) {
    const result = await sendEmail({
      organizationId: user.organizationId,
      to: client.email,
      subject: `Tu cotización: ${quote.title}`,
      body: `Hola ${client.firstName}:

${quote.message ?? "Te preparé una cotización para tu próximo viaje."}

Podés ver el detalle y aceptarla desde tu portal: ${appUrl}${link}
${client.inviteCode ? `\nSi todavía no tenés cuenta, registrate con el código ${client.inviteCode}.` : ""}

${user.name}`,
      fromName: user.organization.name,
      clientId: client.id,
      bookingId: quote.bookingId,
    });
    emailNote = result.status === "SENT" ? " y se le envió un email" : result.status === "LOGGED" ? " (email registrado; configurá SMTP para enviarlo)" : ` (falló el email: ${result.error})`;
  }
  await logActivity({
    organizationId: user.organizationId,
    clientId: client.id,
    bookingId: quote.bookingId,
    userId: user.id,
    type: "quote",
    description: `Cotización enviada: ${quote.title}`,
  });
  revalidatePath(path(quote.bookingId));
  return { ok: `Cotización publicada en el portal del cliente${emailNote}.` };
}

/** Borrador del mensaje de la cotización escrito por la IA. */
export async function generateQuoteMessage(quoteId: string): Promise<{ message?: string; error?: string }> {
  const { user } = await ownQuote(quoteId);
  try {
    return { message: await draftQuoteMessage({ quoteId, organizationId: user.organizationId }) };
  } catch (e) {
    if (e instanceof AIError) return { error: e.message };
    console.error(e);
    return { error: "No se pudo generar el mensaje." };
  }
}
