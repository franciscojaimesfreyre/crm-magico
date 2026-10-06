"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { confirmUpload, createUploadTarget, duplicateUpload, removeUpload, saveUpload, storageMode } from "@/lib/storage";
import { logActivity, notifyClient } from "@/lib/events";
import type { ActionState } from "@/components/form-controls";

function cleanUrl(value: FormDataEntryValue | null) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Link firmado para que el navegador suba el archivo directo a Cloudflare R2. */
export async function requestUploadUrl(name: string, contentType: string, size: number) {
  const user = await requireUser();
  if (!user.organizationId) return { error: "Sin permiso" };
  if (storageMode() !== "r2") return { error: "La subida directa no está configurada" };
  return createUploadTarget(user.organizationId, name, contentType, size);
}

type Stored = { key: string; size: number; mimeType: string };

/**
 * Archivo que llega con el formulario: o ya subido a R2 por el navegador (uploadKey),
 * o el archivo en sí (modo local). Devuelve null si no vino ninguno.
 */
async function incomingFile(formData: FormData, organizationId: string): Promise<{ stored: Stored; name: string } | { error: string } | null> {
  if (formData.get("uploadPending") === "1") return { error: "Esperá a que termine de subir el archivo" };
  const uploadKey = String(formData.get("uploadKey") ?? "");
  if (uploadKey) {
    const stored = await confirmUpload(organizationId, uploadKey);
    if (!stored) return { error: "No encontramos el archivo subido. Probá subirlo de nuevo." };
    return { stored, name: String(formData.get("uploadName") ?? "").trim() || "Archivo" };
  }
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    try {
      return { stored: await saveUpload(file, organizationId), name: file.name };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No se pudo subir el archivo" };
    }
  }
  return null;
}

// ─── Documentos de una reserva ───────────────────────────────────────────────

export async function addBookingDocument(bookingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const booking = await db.booking.findFirst({ where: { id: bookingId, organizationId: user.organizationId } });
  if (!booking) return { error: "Viaje no encontrado" };
  const url = cleanUrl(formData.get("url"));
  const visibleToClient = formData.get("visibleToClient") === "on";
  let name = String(formData.get("name") ?? "").trim();

  const incoming = await incomingFile(formData, user.organizationId);
  if (incoming && "error" in incoming) return { error: incoming.error };
  const stored = incoming?.stored ?? null;
  if (incoming) {
    name ||= incoming.name;
  } else if (url) {
    name ||= url;
  } else {
    return { error: "Elegí un archivo o pegá un link" };
  }

  await db.document.create({
    data: {
      organizationId: user.organizationId,
      bookingId,
      clientId: booking.clientId,
      name,
      storageKey: stored?.key,
      size: stored?.size,
      mimeType: stored?.mimeType,
      url: stored ? null : url,
      visibleToClient,
      uploadedById: user.id,
    },
  });
  if (visibleToClient) {
    await notifyClient({
      organizationId: user.organizationId,
      clientId: booking.clientId,
      title: "Hay un documento nuevo en tu viaje",
      body: name,
      link: `/portal/viajes/${bookingId}?tab=documentos`,
    });
  }
  await logActivity({ organizationId: user.organizationId, clientId: booking.clientId, bookingId, userId: user.id, type: "document", description: `Documento agregado: ${name}` });
  revalidatePath(`/app/viajes/${bookingId}`);
  return { ok: "Documento agregado" };
}

export async function attachFromLibrary(bookingId: string, formData: FormData) {
  const user = await requireUser();
  const booking = await db.booking.findFirst({ where: { id: bookingId, organizationId: user.organizationId } });
  const libraryId = String(formData.get("libraryId") ?? "");
  const lib = await db.libraryDocument.findFirst({ where: { id: libraryId, organizationId: user.organizationId } });
  if (!booking || !lib) return;
  // Se copia el archivo: borrar el original de la biblioteca no afecta a la reserva.
  const key = lib.storageKey ? await duplicateUpload(lib.storageKey, user.organizationId) : null;
  await db.document.create({
    data: {
      organizationId: user.organizationId,
      bookingId,
      clientId: booking.clientId,
      name: lib.name,
      storageKey: key,
      url: lib.url,
      size: lib.size,
      mimeType: lib.mimeType,
      visibleToClient: true,
      uploadedById: user.id,
    },
  });
  await notifyClient({
    organizationId: user.organizationId,
    clientId: booking.clientId,
    title: "Hay un documento nuevo en tu viaje",
    body: lib.name,
    link: `/portal/viajes/${bookingId}?tab=documentos`,
  });
  revalidatePath(`/app/viajes/${bookingId}`);
}

export async function toggleDocumentVisibility(id: string) {
  const user = await requireUser();
  const doc = await db.document.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!doc) return;
  await db.document.update({ where: { id }, data: { visibleToClient: !doc.visibleToClient } });
  if (doc.bookingId) revalidatePath(`/app/viajes/${doc.bookingId}`);
}

export async function deleteDocument(id: string) {
  const user = await requireUser();
  const doc = await db.document.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!doc) return;
  await db.document.delete({ where: { id } });
  if (doc.storageKey) await removeUpload(doc.storageKey);
  if (doc.bookingId) revalidatePath(`/app/viajes/${doc.bookingId}`);
}

// ─── Biblioteca ──────────────────────────────────────────────────────────────

export async function addLibraryDocument(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const url = cleanUrl(formData.get("url"));
  const folder = String(formData.get("folder") ?? "").trim() || null;
  let name = String(formData.get("name") ?? "").trim();
  const incoming = await incomingFile(formData, user.organizationId);
  if (incoming && "error" in incoming) return { error: incoming.error };
  const stored = incoming?.stored ?? null;
  if (incoming) {
    name ||= incoming.name;
  } else if (url) {
    name ||= url;
  } else {
    return { error: "Elegí un archivo o pegá un link (Canva, Google Docs…)" };
  }
  await db.libraryDocument.create({
    data: {
      organizationId: user.organizationId,
      folder,
      name,
      storageKey: stored?.key,
      size: stored?.size,
      mimeType: stored?.mimeType,
      url: stored ? null : url,
    },
  });
  revalidatePath("/app/documentos");
  return { ok: "Agregado a la biblioteca" };
}

export async function deleteLibraryDocument(id: string) {
  const user = await requireUser();
  const doc = await db.libraryDocument.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!doc) return;
  await db.libraryDocument.delete({ where: { id } });
  if (doc.storageKey) await removeUpload(doc.storageKey);
  revalidatePath("/app/documentos");
}
