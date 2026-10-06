"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { endStaffSession, hashPassword, homeFor, startStaffSession, verifyPassword } from "@/lib/auth";
import { provisionOrganization } from "@/lib/provision";
import { shortCode } from "@/lib/crypto";
import { findAgencyByCode, newInviteCode, normalizeInviteCode } from "@/lib/agencies";
import type { ActionState } from "@/components/form-controls";

const SignupSchema = z.object({
  businessName: z.string().trim().min(2, "Ingresá el nombre"),
  name: z.string().trim().min(2, "Ingresá tu nombre"),
  email: z.email("Email inválido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

function slugCode(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  return base || shortCode(6);
}

/** Alta de un agente. Si trae el código de una agencia, queda trabajando con ella. */
export async function signup(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { businessName, name, email, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) {
    return { error: "Ya existe una cuenta con ese email" };
  }
  const agencyCode = normalizeInviteCode(formData.get("agencyCode"));
  const agency = agencyCode ? await findAgencyByCode(agencyCode) : null;
  if (agencyCode && !agency) {
    return { error: "No encontramos una agencia con ese código. Revisalo o dejalo vacío." };
  }

  let marketingCode = slugCode(businessName);
  if (await db.organization.findUnique({ where: { marketingCode } })) {
    marketingCode = `${marketingCode.slice(0, 6)}${shortCode(4)}`;
  }

  const isFirstUser = (await db.user.count()) === 0;
  const org = await db.organization.create({
    data: {
      name: businessName,
      marketingCode,
      contactEmail: email,
      ...(agency && { agencyId: agency.id, agencyJoinedAt: new Date() }),
      users: {
        create: {
          name,
          email,
          passwordHash: await hashPassword(password),
          role: "AGENT",
          // El primer usuario del sistema administra las novedades globales.
          isPlatformAdmin: isFirstUser,
        },
      },
    },
    include: { users: true },
  });
  await provisionOrganization(org.id);
  await startStaffSession(org.users[0].id);
  redirect("/app");
}

/** Alta de una agencia: ve las ventas y comisiones de los agentes que invita, sin poder editarlas. */
export async function signupAgency(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { businessName, name, email, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) {
    return { error: "Ya existe una cuenta con ese email" };
  }
  const agency = await db.agency.create({
    data: {
      name: businessName,
      contactName: name,
      contactEmail: email,
      inviteCode: await newInviteCode(businessName),
      users: { create: { name, email, passwordHash: await hashPassword(password), role: "AGENCY" } },
    },
    include: { users: true },
  });
  await startStaffSession(agency.users[0].id);
  redirect("/agencia");
}

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email o contraseña incorrectos" };
  }
  await startStaffSession(user.id);
  redirect(homeFor(user));
}

export async function logout() {
  await endStaffSession();
  redirect("/login");
}
