"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { uniqueInviteCode } from "@/lib/invite";
import { parseDateInput } from "@/lib/format";
import { splitList } from "@/lib/clients";
import { logActivity } from "@/lib/events";
import { runEventWorkflows } from "@/lib/automations";
import { sendEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/templating";
import { buildTemplateVars } from "@/lib/template-context";
import type { ActionState } from "@/components/form-controls";
import type { BudgetLevel, TripPace } from "@/generated/prisma/enums";
import { appUrl } from "@/lib/app-url";

async function ownClient(id: string) {
  const user = await requireUser();
  const client = await db.client.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!client) throw new Error("Cliente no encontrado");
  return { user, client };
}

const ClientSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio"),
  lastName: z.string().trim().min(1, "El apellido es obligatorio"),
  email: z.union([z.email("Email inválido"), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  notes: z.string().optional(),
});

function clientData(formData: FormData) {
  const opt = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return {
    tags: splitList(formData.get("tags")),
    pace: (opt("pace") as TripPace | null) ?? null,
    budgetLevel: (opt("budgetLevel") as BudgetLevel | null) ?? null,
    interests: [...formData.getAll("interests").map(String), ...splitList(formData.get("otherInterests"))],
    favoriteParks: splitList(formData.get("favoriteParks")),
    dietaryNotes: opt("dietaryNotes"),
    accessibilityNotes: opt("accessibilityNotes"),
    previousVisits: opt("previousVisits"),
    preferenceNotes: opt("preferenceNotes"),
    referredById: opt("referredById"),
  };
}

export async function createClient(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = ClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const extra = clientData(formData);
  const client = await db.client.create({
    data: {
      organizationId: user.organizationId,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email || null,
      phone: d.phone || null,
      city: d.city || null,
      country: d.country || null,
      notes: d.notes || null,
      ...extra,
      ownerId: user.id,
      source: extra.referredById ? "REFERRAL" : "MANUAL",
      inviteCode: await uniqueInviteCode(),
    },
  });
  // El titular queda cargado como primer viajero.
  await db.traveler.create({
    data: { clientId: client.id, firstName: d.firstName, lastName: d.lastName, relationship: "Titular" },
  });
  await logActivity({
    organizationId: user.organizationId,
    clientId: client.id,
    userId: user.id,
    type: "created",
    description: "Cliente creado",
  });
  await runEventWorkflows({ organizationId: user.organizationId, trigger: "CLIENT_CREATED", clientId: client.id });
  // La ficha muestra el aviso "Cliente creado" con el botón para crear su viaje.
  redirect(`/app/clientes/${client.id}?creado=1${formData.get("para") === "viaje" ? "&para=viaje" : ""}`);
}

export async function updateClient(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await ownClient(id);
  const parsed = ClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await db.client.update({
    where: { id },
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email || null,
      phone: d.phone || null,
      city: d.city || null,
      country: d.country || null,
      notes: d.notes || null,
      ...clientData(formData),
    },
  });
  await logActivity({ organizationId: user.organizationId, clientId: id, userId: user.id, type: "updated", description: "Datos del cliente actualizados" });
  redirect(`/app/clientes/${id}`);
}

export async function deleteClient(id: string) {
  await ownClient(id);
  await db.client.delete({ where: { id } });
  redirect("/app/clientes");
}

// ─── Viajeros ────────────────────────────────────────────────────────────────

function travelerData(formData: FormData) {
  const opt = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const height = Number(formData.get("heightCm"));
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: opt("lastName"),
    birthDate: parseDateInput(formData.get("birthDate")),
    heightCm: Number.isFinite(height) && height > 0 ? Math.round(height) : null,
    relationship: opt("relationship"),
    dietaryNotes: opt("dietaryNotes"),
    accessibilityNotes: opt("accessibilityNotes"),
    passportExpiry: parseDateInput(formData.get("passportExpiry")),
    notes: opt("notes"),
  };
}

export async function addTraveler(clientId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await ownClient(clientId);
  const data = travelerData(formData);
  if (!data.firstName) return { error: "El nombre del viajero es obligatorio" };
  await db.traveler.create({ data: { clientId, ...data } });
  revalidatePath(`/app/clientes/${clientId}`);
  return { ok: "Viajero agregado" };
}

export async function updateTraveler(travelerId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const traveler = await db.traveler.findFirst({ where: { id: travelerId, client: { organizationId: user.organizationId } } });
  if (!traveler) return { error: "Viajero no encontrado" };
  const data = travelerData(formData);
  if (!data.firstName) return { error: "El nombre del viajero es obligatorio" };
  await db.traveler.update({ where: { id: travelerId }, data });
  revalidatePath(`/app/clientes/${traveler.clientId}`);
  return { ok: "Viajero actualizado" };
}

export async function deleteTraveler(travelerId: string) {
  const user = await requireUser();
  const traveler = await db.traveler.findFirst({ where: { id: travelerId, client: { organizationId: user.organizationId } } });
  if (!traveler) return;
  await db.traveler.delete({ where: { id: travelerId } });
  revalidatePath(`/app/clientes/${traveler.clientId}`);
}

// ─── Accesos a portales de proveedores ───────────────────────────────────────

export async function addSupplierLogin(clientId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await ownClient(clientId);
  const supplier = String(formData.get("supplier") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!supplier || !username || !password) return { error: "Completá proveedor, usuario y contraseña" };
  await db.supplierLogin.create({
    data: {
      clientId,
      supplier,
      username,
      passwordEncrypted: encrypt(password),
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  await logActivity({ organizationId: user.organizationId, clientId, userId: user.id, type: "credential", description: `Acceso a ${supplier} guardado` });
  revalidatePath(`/app/clientes/${clientId}`);
  return { ok: "Acceso guardado (cifrado)" };
}

/** Devuelve la contraseña descifrada; queda registrado quién la vio. */
export async function revealSupplierPassword(loginId: string) {
  const user = await requireUser();
  const login = await db.supplierLogin.findFirst({
    where: { id: loginId, client: { organizationId: user.organizationId } },
  });
  if (!login) throw new Error("Acceso no encontrado");
  await logActivity({
    organizationId: user.organizationId,
    clientId: login.clientId,
    userId: user.id,
    type: "credential",
    description: `${user.name} vio la contraseña de ${login.supplier}`,
  });
  return decrypt(login.passwordEncrypted);
}

export async function deleteSupplierLogin(loginId: string) {
  const user = await requireUser();
  const login = await db.supplierLogin.findFirst({ where: { id: loginId, client: { organizationId: user.organizationId } } });
  if (!login) return;
  await db.supplierLogin.delete({ where: { id: loginId } });
  revalidatePath(`/app/clientes/${login.clientId}`);
}

// ─── Portal e invitaciones ───────────────────────────────────────────────────

export async function regenerateInviteCode(clientId: string) {
  await ownClient(clientId);
  await db.client.update({ where: { id: clientId }, data: { inviteCode: await uniqueInviteCode() } });
  revalidatePath(`/app/clientes/${clientId}`);
}

export async function sendPortalInvite(clientId: string, _state?: ActionState, _formData?: FormData): Promise<ActionState> {
  const { user, client } = await ownClient(clientId);
  if (!client.email) return { error: "El cliente no tiene email cargado" };
  const baseUrl = appUrl();
  const result = await sendEmail({
    organizationId: user.organizationId,
    to: client.email,
    subject: `${user.organization.name} te invita a tu portal de viajes`,
    body: `Hola ${client.firstName}:

En tu portal vas a poder ver tus viajes, el itinerario día por día, los documentos y escribirme directamente.

1. Entrá a ${baseUrl}/portal/registro
2. Usá este código de invitación: ${client.inviteCode}
3. Elegí tu contraseña.

¡Te espero!
${user.name}`,
    clientId,
  });
  await logActivity({ organizationId: user.organizationId, clientId, userId: user.id, type: "email", description: "Invitación al portal enviada" });
  revalidatePath(`/app/clientes/${clientId}`);
  return result.status === "FAILED"
    ? { error: `No se pudo enviar: ${result.error}` }
    : { ok: result.status === "SENT" ? "Invitación enviada" : "Invitación registrada (configurá SMTP para enviar emails reales)" };
}

// ─── Email directo con plantilla ─────────────────────────────────────────────

export async function sendClientEmail(clientId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, client } = await ownClient(clientId);
  if (!client.email) return { error: "El cliente no tiene email cargado" };
  const bookingId = String(formData.get("bookingId") ?? "") || null;
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject || !body) return { error: "Completá asunto y mensaje" };
  const vars = await buildTemplateVars({ clientId, bookingId, agentName: user.name });
  const result = await sendEmail({
    organizationId: user.organizationId,
    to: client.email,
    subject: renderTemplate(subject, vars),
    body: renderTemplate(body, vars),
    fromName: user.organization.name,
    clientId,
    bookingId,
  });
  await logActivity({ organizationId: user.organizationId, clientId, bookingId, userId: user.id, type: "email", description: `Email enviado: ${renderTemplate(subject, vars)}` });
  revalidatePath(`/app/clientes/${clientId}`);
  return result.status === "FAILED"
    ? { error: `No se pudo enviar: ${result.error}` }
    : { ok: result.status === "SENT" ? "Email enviado" : "Email registrado (sin SMTP configurado no se envía)" };
}
