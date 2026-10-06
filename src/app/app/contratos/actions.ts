"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import { renderTemplate } from "@/lib/templating";
import { buildTemplateVars } from "@/lib/template-context";
import { sendEmail } from "@/lib/email";
import { logActivity, notifyClient } from "@/lib/events";
import type { ActionState } from "@/components/form-controls";
import { appUrl } from "@/lib/app-url";

export async function saveContractTemplate(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!name || !body) return { error: "Completá nombre y texto" };
  if (id) await db.contractTemplate.updateMany({ where: { id, organizationId: user.organizationId }, data: { name, body } });
  else await db.contractTemplate.create({ data: { organizationId: user.organizationId, name, body } });
  revalidatePath("/app/contratos");
  return { ok: "Plantilla guardada" };
}

export async function deleteContractTemplate(id: string) {
  const user = await requireUser();
  await db.contractTemplate.deleteMany({ where: { id, organizationId: user.organizationId } });
  revalidatePath("/app/contratos");
}

/** Genera el contrato completando las variables con los datos del cliente y la reserva. */
export async function createContract(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId") ?? "") || null;
  let clientId = String(formData.get("clientId") ?? "") || null;
  if (bookingId) {
    const booking = await db.booking.findFirst({ where: { id: bookingId, organizationId: user.organizationId } });
    if (!booking) return { error: "Viaje no encontrado" };
    clientId = booking.clientId;
  }
  if (!clientId) return { error: "Elegí un cliente o un viaje" };
  const client = await db.client.findFirst({ where: { id: clientId, organizationId: user.organizationId } });
  if (!client) return { error: "Cliente no encontrado" };
  const template = await db.contractTemplate.findFirst({
    where: { id: String(formData.get("templateId") ?? ""), organizationId: user.organizationId },
  });
  if (!template) return { error: "Elegí una plantilla" };
  const vars = await buildTemplateVars({ clientId, bookingId, agentName: user.name });
  const contract = await db.contract.create({
    data: {
      organizationId: user.organizationId,
      templateId: template.id,
      clientId,
      bookingId,
      title: template.name,
      body: renderTemplate(template.body, vars),
      expiresAt: parseDateInput(formData.get("expiresAt")),
    },
  });
  redirect(`/app/contratos/${contract.id}`);
}

export async function updateContractBody(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const contract = await db.contract.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!contract) return { error: "Contrato no encontrado" };
  if (contract.status === "SIGNED") return { error: "Un contrato firmado no se puede modificar" };
  await db.contract.update({
    where: { id },
    data: { title: String(formData.get("title") ?? contract.title), body: String(formData.get("body") ?? contract.body) },
  });
  revalidatePath(`/app/contratos/${id}`);
  return { ok: "Contrato guardado" };
}

export async function sendContract(id: string, _?: ActionState, _f?: FormData): Promise<ActionState> {
  const user = await requireUser();
  const contract = await db.contract.findFirst({ where: { id, organizationId: user.organizationId }, include: { client: true } });
  if (!contract) return { error: "Contrato no encontrado" };
  if (contract.status === "SIGNED") return { error: "Ya está firmado" };
  const link = `${appUrl()}/firmar/${contract.token}`;
  let note = "";
  if (contract.client.email) {
    const r = await sendEmail({
      organizationId: user.organizationId,
      to: contract.client.email,
      subject: `Contrato para firmar: ${contract.title}`,
      body: `Hola ${contract.client.firstName}:\n\nTe envío el contrato "${contract.title}" para que lo leas y lo firmes online (no necesitás crear una cuenta):\n\n${link}\n\n${user.name}\n${user.organization.name}`,
      fromName: user.organization.name,
      clientId: contract.clientId,
      bookingId: contract.bookingId,
    });
    note = r.status === "SENT" ? " y se envió por email" : r.status === "LOGGED" ? " (email registrado; configurá SMTP para enviarlo)" : ` (falló el email: ${r.error})`;
  }
  await notifyClient({ organizationId: user.organizationId, clientId: contract.clientId, title: "Tenés un contrato para firmar", body: contract.title, link: `/firmar/${contract.token}` });
  await db.contract.update({ where: { id }, data: { status: contract.status === "VIEWED" ? "VIEWED" : "SENT", sentAt: new Date() } });
  await logActivity({ organizationId: user.organizationId, clientId: contract.clientId, bookingId: contract.bookingId, userId: user.id, type: "contract", description: `Contrato enviado: ${contract.title}` });
  revalidatePath(`/app/contratos/${id}`);
  return { ok: `Contrato listo para firmar${note}. También podés copiar el link y mandarlo por WhatsApp.` };
}

export async function deleteContract(id: string) {
  const user = await requireUser();
  await db.contract.deleteMany({ where: { id, organizationId: user.organizationId } });
  redirect("/app/contratos?tab=enviados");
}
