import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

export { hashPassword, verifyPassword } from "@/lib/password";

const STAFF_COOKIE = "crm_session";
const PORTAL_COOKIE = "portal_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("Falta SESSION_SECRET en el entorno");
  return new TextEncoder().encode(value);
}

async function sign(payload: Record<string, string>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

async function read(cookieName: string) {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as Record<string, string>;
  } catch {
    return null;
  }
}

async function write(cookieName: string, token: string) {
  const store = await cookies();
  store.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

// ─── Agentes (CRM) ───────────────────────────────────────────────────────────

export async function startStaffSession(userId: string) {
  await write(STAFF_COOKIE, await sign({ uid: userId }));
}

export async function endStaffSession() {
  (await cookies()).delete(STAFF_COOKIE);
}

/** Usuario logueado (agente o agencia) o null. Cacheado por request. */
export const getCurrentUser = cache(async () => {
  const session = await read(STAFF_COOKIE);
  if (!session?.uid) return null;
  const user = await db.user.findUnique({
    where: { id: session.uid },
    include: { organization: { include: { agency: true } }, agency: true },
  });
  if (!user || !user.active) return null;
  return user;
});

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** A dónde va cada usuario después de ingresar. */
export function homeFor(user: { role: string }) {
  return user.role === "AGENCY" ? "/agencia" : "/app";
}

/** Agente logueado en el CRM, con su negocio. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "AGENT" || !user.organizationId || !user.organization) redirect(homeFor(user));
  return user as CurrentUser & { organizationId: string; organization: NonNullable<CurrentUser["organization"]> };
}

/** Usuario de una agencia, para su panel de solo lectura. */
export async function requireAgencyUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "AGENCY" || !user.agencyId || !user.agency) redirect(homeFor(user));
  return user as CurrentUser & { agencyId: string; agency: NonNullable<CurrentUser["agency"]> };
}

// ─── Clientes (portal) ───────────────────────────────────────────────────────

export async function startPortalSession(accountId: string) {
  await write(PORTAL_COOKIE, await sign({ aid: accountId }));
}

export async function endPortalSession() {
  (await cookies()).delete(PORTAL_COOKIE);
}

export const getCurrentClientAccount = cache(async () => {
  const session = await read(PORTAL_COOKIE);
  if (!session?.aid) return null;
  return db.clientAccount.findUnique({
    where: { id: session.aid },
    include: { client: { include: { organization: true, owner: true } } },
  });
});

export async function requireClientAccount() {
  const account = await getCurrentClientAccount();
  if (!account) redirect("/portal/login");
  return account;
}
