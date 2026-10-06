"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logActivity, notifyStaff } from "@/lib/events";
import type { ActionState } from "@/components/form-controls";

export async function signContract(token: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const contract = await db.contract.findUnique({ where: { token }, include: { client: true } });
  if (!contract) return { error: "Contrato no encontrado" };
  if (contract.status === "SIGNED") return { error: "Este contrato ya fue firmado" };
  if (contract.expiresAt && contract.expiresAt < new Date()) return { error: "El contrato venció. Pedile uno nuevo a tu agente." };
  const name = String(formData.get("signerName") ?? "").trim();
  const signature = String(formData.get("signature") ?? "");
  if (name.length < 3) return { error: "Escribí tu nombre completo" };
  if (formData.get("accept") !== "on") return { error: "Tenés que aceptar los términos para firmar" };
  if (signature && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature)) return { error: "Firma inválida" };
  if (signature.length > 500_000) return { error: "La firma es demasiado grande" };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  await db.contract.update({
    where: { id: contract.id },
    data: { status: "SIGNED", signedAt: new Date(), signerName: name, signatureImage: signature || null, signerIp: ip },
  });
  await notifyStaff({
    organizationId: contract.organizationId,
    userId: contract.client.ownerId,
    title: `✍️ ${contract.client.firstName} ${contract.client.lastName} firmó el contrato`,
    body: contract.title,
    link: `/app/contratos/${contract.id}`,
  });
  await logActivity({ organizationId: contract.organizationId, clientId: contract.clientId, bookingId: contract.bookingId, type: "contract", description: `Contrato firmado: ${contract.title}` });
  revalidatePath(`/firmar/${token}`);
  return { ok: "¡Gracias! El contrato quedó firmado." };
}
