import "server-only";
import { db } from "@/lib/db";
import { shortCode } from "@/lib/crypto";

/** Normaliza lo que escribe el agente: "madre-01 " → "MADRE01". */
export function normalizeInviteCode(code: unknown) {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Código de invitación libre, derivado del nombre de la agencia. */
export async function newInviteCode(name: string) {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  let code = base.length >= 3 ? base : shortCode(6);
  while (await db.agency.findUnique({ where: { inviteCode: code } })) code = `${base.slice(0, 5)}${shortCode(4)}`;
  return code;
}

/** Agencia de la plataforma con ese código de invitación, o null. */
export async function findAgencyByCode(code: unknown) {
  const inviteCode = normalizeInviteCode(code);
  if (!inviteCode) return null;
  return db.agency.findUnique({ where: { inviteCode } });
}

/**
 * El agente pasa a trabajar con una agencia de la plataforma. Si tenía una agencia privada cargada
 * y nadie más la usa, se borra salvo que figure en planillas ya generadas.
 */
export async function joinAgency(organizationId: string, agencyId: string) {
  const org = await db.organization.update({
    where: { id: organizationId },
    data: { agencyId, agencyJoinedAt: new Date() },
    select: { id: true },
  });
  await removeOrphanAgencies();
  return org;
}

/** El agente deja la agencia de la plataforma. Sus datos no se tocan: la agencia solo deja de ver sus números. */
export async function leaveAgency(organizationId: string) {
  await db.organization.update({ where: { id: organizationId }, data: { agencyId: null, agencyJoinedAt: null } });
}

/** Agencias privadas que ya no usa ningún agente ni ninguna planilla. */
export async function removeOrphanAgencies() {
  await db.agency.deleteMany({
    where: { inviteCode: null, agents: { none: {} }, statements: { none: {} }, users: { none: {} } },
  });
}

/** True si la agencia está en la plataforma (el agente no puede editarla). */
export function isPlatformAgency(agency: { inviteCode: string | null } | null | undefined) {
  return Boolean(agency?.inviteCode);
}
