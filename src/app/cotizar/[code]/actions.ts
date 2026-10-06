"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { parseDateInput } from "@/lib/format";
import { nextBookingCode } from "@/lib/bookings";
import { uniqueInviteCode } from "@/lib/invite";
import { logActivity, notifyStaff } from "@/lib/events";
import { runEventWorkflows } from "@/lib/automations";
import { DESTINATION_LABEL } from "@/lib/labels";
import type { ActionState } from "@/components/form-controls";
import type { Destination } from "@/generated/prisma/enums";

const LeadSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá tu nombre").max(80),
  lastName: z.string().trim().min(1, "Ingresá tu apellido").max(80),
  email: z.email("Email inválido").trim().toLowerCase(),
  phone: z.string().trim().max(40).optional(),
  destination: z.string(),
  notes: z.string().max(3000).optional(),
});

export async function submitLead(code: string, _: ActionState, formData: FormData): Promise<ActionState> {
  // Campo trampa para bots: los humanos no lo ven.
  if (String(formData.get("website") ?? "")) return { ok: "¡Gracias!" };
  const org = await db.organization.findUnique({ where: { marketingCode: code } });
  if (!org) return { error: "Formulario no disponible" };
  const parsed = LeadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const destination = (d.destination in DESTINATION_LABEL ? d.destination : "OTHER") as Destination;
  const startDate = parseDateInput(formData.get("startDate"));
  const endDate = parseDateInput(formData.get("endDate"));

  const names = formData.getAll("travelerName").map(String);
  const ages = formData.getAll("travelerAge").map(String);
  const travelers = names
    .map((name, i) => ({ name: name.trim(), age: Number(ages[i]) }))
    .filter((t) => t.name)
    .slice(0, 15);
  const today = new Date();

  // Si el email ya es cliente, se reutiliza la ficha.
  let client = await db.client.findFirst({ where: { organizationId: org.id, email: d.email } });
  const isNew = !client;
  if (!client) {
    const owner = await db.user.findFirst({ where: { organizationId: org.id, active: true }, orderBy: { createdAt: "asc" } });
    client = await db.client.create({
      data: {
        organizationId: org.id,
        ownerId: owner?.id,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone || null,
        source: "QUOTE_FORM",
        inviteCode: await uniqueInviteCode(),
      },
    });
  }
  const existingTravelers = await db.traveler.findMany({ where: { clientId: client.id } });
  const travelerIds: string[] = [];
  for (const t of travelers) {
    const [firstName, ...rest] = t.name.split(/\s+/);
    const match = existingTravelers.find((e) => e.firstName.toLowerCase() === firstName.toLowerCase());
    if (match) {
      travelerIds.push(match.id);
      continue;
    }
    const birthDate = Number.isFinite(t.age) && t.age >= 0 && t.age < 120 ? new Date(Date.UTC(today.getUTCFullYear() - t.age, 0, 1)) : null;
    const created = await db.traveler.create({
      data: { clientId: client.id, firstName, lastName: rest.join(" ") || d.lastName, birthDate, notes: birthDate ? "Edad aproximada (formulario web)" : null },
    });
    travelerIds.push(created.id);
  }
  const children = travelers.filter((t) => Number.isFinite(t.age) && t.age < 18).length;

  const booking = await db.booking.create({
    data: {
      organizationId: org.id,
      code: await nextBookingCode(org.id),
      clientId: client.id,
      agentId: client.ownerId,
      title: `${DESTINATION_LABEL[destination]}${startDate ? ` ${startDate.getUTCFullYear()}` : ""} — ${d.lastName}`,
      destination,
      status: "INQUIRY",
      startDate,
      endDate,
      adults: Math.max(travelers.length - children, 1),
      children,
      clientNotes: d.notes || null,
      notes: "Consulta recibida desde el formulario web.",
      travelers: { create: travelerIds.map((travelerId) => ({ travelerId })) },
    },
  });
  if (d.notes) await db.message.create({ data: { clientId: client.id, bookingId: booking.id, senderType: "CLIENT", body: d.notes } });

  await notifyStaff({
    organizationId: org.id,
    userId: client.ownerId,
    title: `Nueva consulta web: ${d.firstName} ${d.lastName}`,
    body: `${DESTINATION_LABEL[destination]} · ${travelers.length || "?"} viajeros`,
    link: `/app/viajes/${booking.id}`,
  });
  await logActivity({ organizationId: org.id, clientId: client.id, bookingId: booking.id, type: "lead", description: "Consulta recibida desde el formulario web" });
  if (isNew) await runEventWorkflows({ organizationId: org.id, trigger: "CLIENT_CREATED", clientId: client.id });
  await runEventWorkflows({ organizationId: org.id, trigger: "BOOKING_CREATED", clientId: client.id, bookingId: booking.id });
  return { ok: `¡Gracias, ${d.firstName}! Recibimos tu consulta y te vamos a contactar muy pronto.` };
}
