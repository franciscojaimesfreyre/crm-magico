"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import { syncBookingStatus } from "@/lib/bookings";
import { logActivity, notifyClient } from "@/lib/events";
import { sendEmail } from "@/lib/email";
import { AIError, draftQuoteMessage } from "@/lib/ai";
import type { ActionState } from "@/components/form-controls";
import type { ItemType } from "@/generated/prisma/enums";
import { appUrl } from "@/lib/app-url";
import { commissionFromForm } from "@/lib/trips";
import { acceptQuoteOption } from "@/lib/quotes";
import { incomingFiles, type StoredFile } from "@/lib/incoming-files";
import { duplicateUpload, removeUpload } from "@/lib/storage";

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

/** Adjuntos de un servicio (PDF del proveedor, folleto, foto): el cliente los ve en la cotización. */
async function saveQuoteItemFiles(files: StoredFile[], ctx: { organizationId: string; userId: string; bookingId: string; clientId: string; quoteItemId: string }) {
  if (files.length === 0) return;
  await db.document.createMany({
    data: files.map((f) => ({
      organizationId: ctx.organizationId,
      bookingId: ctx.bookingId,
      clientId: ctx.clientId,
      quoteItemId: ctx.quoteItemId,
      name: f.name,
      storageKey: f.stored.key,
      size: f.stored.size,
      mimeType: f.stored.mimeType,
      visibleToClient: true,
      uploadedById: ctx.userId,
    })),
  });
}

/** Borra los adjuntos de servicios que se eliminan (los que ya pasaron a una reserva se quedan con ella). */
async function removeQuoteItemFiles(quoteItemIds: string[]) {
  const docs = await db.document.findMany({ where: { quoteItemId: { in: quoteItemIds }, bookingItemId: null } });
  if (docs.length === 0) return;
  await db.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
  for (const d of docs) if (d.storageKey) await removeUpload(d.storageKey);
}

export async function createQuote(bookingId: string) {
  const user = await requireUser();
  const booking = await db.booking.findFirst({
    where: { id: bookingId, organizationId: user.organizationId },
    include: { items: { where: { status: { not: "CANCELLED" } }, orderBy: { position: "asc" } } },
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
          // Si el viaje ya tiene reservas, se usan como punto de partida; cada servicio recuerda de qué reserva
          // salió, así al aceptarse la cotización se actualiza esa reserva en vez de duplicarla.
          items: {
            create: booking.items.map((i, idx) => ({
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
              sourceItemId: i.id,
              position: idx,
            })),
          },
        },
      },
    },
  });
  revalidatePath(path(bookingId));
}

/**
 * Guarda el título, la validez y el mensaje. Con intent=send, además la envía: así lo que el agente acaba de
 * escribir sale en el email aunque no haya apretado Guardar antes.
 */
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
  if (formData.get("intent") === "send") return sendQuote(quoteId);
  revalidatePath(path(quote.bookingId));
  return { ok: "Cotización guardada" };
}

export async function deleteQuote(quoteId: string) {
  const { user, quote } = await ownQuote(quoteId);
  const items = await db.quoteItem.findMany({ where: { option: { quoteId } }, select: { id: true } });
  await removeQuoteItemFiles(items.map((i) => i.id));
  await db.quote.delete({ where: { id: quoteId } });
  // Si era la única cotización activa, el viaje vuelve a Consulta.
  await syncBookingStatus(quote.bookingId, user.id);
  revalidatePath(path(quote.bookingId));
}

/** Copia una cotización (opciones y servicios) como borrador nuevo, para armar una variante sin empezar de cero. */
export async function duplicateQuote(quoteId: string) {
  const { user, quote } = await ownQuote(quoteId);
  const options = await db.quoteOption.findMany({
    where: { quoteId },
    orderBy: { position: "asc" },
    include: { items: { orderBy: { position: "asc" }, include: { documents: true } } },
  });
  const copy = await db.quote.create({ data: { bookingId: quote.bookingId, title: `${quote.title} (copia)`, message: quote.message } });
  for (const o of options) {
    const option = await db.quoteOption.create({ data: { quoteId: copy.id, name: o.name, description: o.description, position: o.position } });
    for (const i of o.items) {
      const item = await db.quoteItem.create({
        data: {
          optionId: option.id,
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
          sourceItemId: i.sourceItemId,
          position: i.position,
        },
      });
      // Los adjuntos se copian: borrar la cotización original no deja a la copia sin ellos.
      for (const d of i.documents) {
        const key = d.storageKey ? await duplicateUpload(d.storageKey, user.organizationId) : null;
        await db.document.create({
          data: {
            organizationId: d.organizationId,
            bookingId: d.bookingId,
            clientId: d.clientId,
            quoteItemId: item.id,
            name: d.name,
            storageKey: key,
            url: d.url,
            size: d.size,
            mimeType: d.mimeType,
            visibleToClient: true,
            uploadedById: user.id,
          },
        });
      }
    }
  }
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
  const items = await db.quoteItem.findMany({ where: { optionId }, select: { id: true } });
  await removeQuoteItemFiles(items.map((i) => i.id));
  await db.quoteOption.delete({ where: { id: optionId } });
  revalidatePath(path(option.quote.bookingId));
}

/** Datos de un servicio de la cotización, tal como llegan del formulario. */
function quoteItemFields(formData: FormData) {
  const number = (key: string) => {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    type: String(formData.get("type") ?? "OTHER") as ItemType,
    description: String(formData.get("description") ?? "").trim(),
    supplier: String(formData.get("supplier") ?? "").trim() || null,
    startDate: parseDateInput(formData.get("startDate")),
    endDate: parseDateInput(formData.get("endDate")),
    price: number("price") ?? 0,
    depositAmount: number("depositAmount"),
    notes: String(formData.get("notes") ?? "").trim() || null,
    ...commissionFromForm(formData),
  };
}

function checkQuoteItem(data: ReturnType<typeof quoteItemFields>) {
  if (!data.description) return "Describí el servicio";
  if (data.startDate && data.endDate && data.endDate < data.startDate) return "La fecha de fin no puede ser anterior a la de inicio";
  return null;
}

export async function addQuoteItem(optionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const option = await db.quoteOption.findFirst({
    where: { id: optionId, quote: { booking: { organizationId: user.organizationId } } },
    include: { quote: { include: { booking: { select: { clientId: true } } } } },
  });
  if (!option) return { error: "Opción no encontrada" };
  const data = quoteItemFields(formData);
  const invalid = checkQuoteItem(data);
  if (invalid) return { error: invalid };
  const files = await incomingFiles(formData, user.organizationId);
  if ("error" in files) return { error: files.error };
  const position = await db.quoteItem.count({ where: { optionId } });
  const item = await db.quoteItem.create({ data: { optionId, ...data, position } });
  await saveQuoteItemFiles(files, { organizationId: user.organizationId, userId: user.id, bookingId: option.quote.bookingId, clientId: option.quote.booking.clientId, quoteItemId: item.id });
  revalidatePath(path(option.quote.bookingId));
  return { ok: "Servicio agregado" };
}

/** Editar un servicio de la cotización (mientras no esté aceptada). */
export async function updateQuoteItem(itemId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const item = await db.quoteItem.findFirst({
    where: { id: itemId, option: { quote: { booking: { organizationId: user.organizationId } } } },
    include: { option: { include: { quote: { include: { booking: { select: { clientId: true } } } } } } },
  });
  if (!item) return { error: "Servicio no encontrado" };
  if (!["DRAFT", "SENT"].includes(item.option.quote.status)) return { error: "La cotización ya fue respondida: los cambios van en las reservas." };
  const data = quoteItemFields(formData);
  const invalid = checkQuoteItem(data);
  if (invalid) return { error: invalid };
  const files = await incomingFiles(formData, user.organizationId);
  if ("error" in files) return { error: files.error };
  await db.quoteItem.update({ where: { id: itemId }, data });
  await saveQuoteItemFiles(files, {
    organizationId: user.organizationId,
    userId: user.id,
    bookingId: item.option.quote.bookingId,
    clientId: item.option.quote.booking.clientId,
    quoteItemId: itemId,
  });
  revalidatePath(path(item.option.quote.bookingId));
  return { ok: "Servicio actualizado" };
}

export async function deleteQuoteItem(itemId: string) {
  const user = await requireUser();
  const item = await db.quoteItem.findFirst({
    where: { id: itemId, option: { quote: { booking: { organizationId: user.organizationId } } } },
    include: { option: { include: { quote: true } } },
  });
  if (!item) return;
  await removeQuoteItemFiles([itemId]);
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
  await syncBookingStatus(quote.bookingId, user.id);
  const client = quote.booking.client;
  const baseUrl = appUrl();
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

Podés ver el detalle y aceptarla desde tu portal: ${baseUrl}${link}
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

/**
 * El cliente aceptó por otro canal (WhatsApp, teléfono…): el agente lo registra y la opción elegida pasa a las
 * reservas igual que si la hubiera aceptado desde el portal.
 */
export async function markQuoteAccepted(quoteId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, quote } = await ownQuote(quoteId);
  if (!["DRAFT", "SENT"].includes(quote.status)) return { error: "Esta cotización ya fue respondida." };
  const optionId = String(formData.get("optionId") ?? "");
  const option = await db.quoteOption.findFirst({ where: { id: optionId, quoteId }, include: { _count: { select: { items: true } } } });
  if (!option) return { error: "Elegí la opción que aceptó el cliente" };
  if (option._count.items === 0) return { error: "Esa opción no tiene servicios" };
  const via = String(formData.get("via") ?? "").trim() || "Otro";
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const replace = formData.get("replace") === "on";
  await acceptQuoteOption({ quoteId, optionId, via, comment, userId: user.id, replace });
  revalidatePath(path(quote.bookingId));
  return { ok: `Listo: "${option.name}" pasó a Reservas, por reservar.` };
}

/** El cliente dijo que no por otro canal: queda registrado, y las reservas no cambian. */
export async function markQuoteRejected(quoteId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, quote } = await ownQuote(quoteId);
  if (!["DRAFT", "SENT"].includes(quote.status)) return { error: "Esta cotización ya fue respondida." };
  const comment = String(formData.get("comment") ?? "").trim() || null;
  await db.quote.update({ where: { id: quoteId }, data: { status: "REJECTED", respondedAt: new Date(), clientComment: comment } });
  await logActivity({
    organizationId: user.organizationId,
    clientId: quote.booking.clientId,
    bookingId: quote.bookingId,
    userId: user.id,
    type: "quote",
    description: `Cotización rechazada por el cliente${comment ? `: ${comment}` : ""}`,
  });
  await syncBookingStatus(quote.bookingId, user.id);
  revalidatePath(path(quote.bookingId));
  return { ok: "Quedó registrada como rechazada" };
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
