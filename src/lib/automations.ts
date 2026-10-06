import "server-only";
import { db } from "@/lib/db";
import type { BookingStatus, Destination, TaskPriority, WorkflowTrigger } from "@/generated/prisma/enums";
import { Prisma, type Workflow } from "@/generated/prisma/client";
import { addDays, todayUTC } from "@/lib/format";
import { renderTemplate } from "@/lib/templating";
import { buildTemplateVars } from "@/lib/template-context";
import { sendEmail } from "@/lib/email";
import { logActivity, notifyStaff } from "@/lib/events";

// ─── Tipos de configuración guardados como JSON ──────────────────────────────

export type TriggerConfig = { status?: BookingStatus; days?: number };

export type WorkflowAction =
  | { type: "CREATE_TASK"; title: string; priority?: TaskPriority; dueInDays?: number }
  | { type: "SEND_EMAIL"; templateId: string }
  | { type: "SEND_MESSAGE"; body: string }
  | { type: "NOTIFY"; title: string };

export const DATE_TRIGGERS: WorkflowTrigger[] = [
  "DAYS_BEFORE_TRAVEL",
  "DAYS_AFTER_TRAVEL",
  "DAYS_BEFORE_FINAL_PAYMENT",
  "DAYS_BEFORE_BIRTHDAY",
  "PASSPORT_EXPIRING",
];

function config(w: Workflow) {
  return (w.triggerConfig ?? {}) as TriggerConfig;
}

function actions(w: Workflow) {
  return (Array.isArray(w.actions) ? w.actions : []) as WorkflowAction[];
}

function appliesTo(w: Workflow, destination: Destination | null | undefined) {
  return w.destinations.length === 0 || (destination != null && w.destinations.includes(destination));
}

// ─── Ejecución de acciones ───────────────────────────────────────────────────

type Target = { clientId: string; bookingId?: string | null; bookingItemId?: string | null };

async function executeActions(w: Workflow, target: Target) {
  const client = await db.client.findUniqueOrThrow({ where: { id: target.clientId } });
  const booking = target.bookingId
    ? await db.booking.findUnique({ where: { id: target.bookingId } })
    : null;
  const vars = await buildTemplateVars({ clientId: target.clientId, bookingId: target.bookingId, bookingItemId: target.bookingItemId });
  const ownerId = booking?.agentId ?? client.ownerId;

  for (const action of actions(w)) {
    switch (action.type) {
      case "CREATE_TASK":
        await db.task.create({
          data: {
            organizationId: w.organizationId,
            title: renderTemplate(action.title, vars),
            priority: action.priority ?? "MEDIUM",
            dueDate: addDays(todayUTC(), action.dueInDays ?? 0),
            assigneeId: ownerId,
            clientId: target.clientId,
            bookingId: target.bookingId ?? undefined,
            automated: true,
          },
        });
        break;
      case "SEND_EMAIL": {
        const template = await db.emailTemplate.findFirst({
          where: { id: action.templateId, organizationId: w.organizationId },
        });
        if (!template) throw new Error("La plantilla de email ya no existe");
        if (!client.email) throw new Error("El cliente no tiene email");
        const result = await sendEmail({
          organizationId: w.organizationId,
          to: client.email,
          subject: renderTemplate(template.subject, vars),
          body: renderTemplate(template.body, vars),
          clientId: client.id,
          bookingId: target.bookingId,
        });
        if (result.status === "FAILED") throw new Error(`Email: ${result.error}`);
        break;
      }
      case "SEND_MESSAGE":
        await db.message.create({
          data: {
            clientId: client.id,
            bookingId: target.bookingId ?? undefined,
            senderType: "AGENT",
            senderUserId: ownerId,
            body: renderTemplate(action.body, vars),
          },
        });
        break;
      case "NOTIFY":
        await notifyStaff({
          organizationId: w.organizationId,
          userId: ownerId,
          title: renderTemplate(action.title, vars),
          link: target.bookingId ? `/app/viajes/${target.bookingId}` : `/app/clientes/${client.id}`,
        });
        break;
    }
  }
  await logActivity({
    organizationId: w.organizationId,
    clientId: target.clientId,
    bookingId: target.bookingId,
    type: "automation",
    description: `Automatización ejecutada: ${w.name}`,
  });
}

/**
 * Corre un workflow una sola vez por dedupeKey. Devuelve true si se ejecutó.
 * Primero reserva la ejecución (la restricción única de la base hace de candado) y después corre
 * las acciones: si dos pedidos llegan a la vez, solo uno ejecuta.
 */
async function runOnce(w: Workflow, dedupeKey: string, target: Target) {
  let runId: string;
  try {
    const run = await db.workflowRun.create({
      data: {
        workflowId: w.id,
        dedupeKey,
        bookingId: target.bookingId ?? undefined,
        clientId: target.clientId,
        success: false,
        error: "En ejecución",
      },
    });
    runId = run.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false; // ya corrió o está corriendo
    throw e;
  }
  let error: string | undefined;
  try {
    await executeActions(w, target);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await db.workflowRun.update({ where: { id: runId }, data: { success: !error, error: error ?? null } });
  return true;
}

// ─── Disparadores por evento ─────────────────────────────────────────────────

export async function runEventWorkflows(input: {
  organizationId: string;
  trigger: "BOOKING_CREATED" | "CLIENT_CREATED" | "STATUS_CHANGED";
  clientId: string;
  bookingId?: string;
  status?: BookingStatus;
}) {
  const workflows = await db.workflow.findMany({
    where: { organizationId: input.organizationId, active: true, trigger: input.trigger },
  });
  if (workflows.length === 0) return;
  const booking = input.bookingId
    ? await db.booking.findUnique({ where: { id: input.bookingId } })
    : null;
  for (const w of workflows) {
    if (!appliesTo(w, booking?.destination)) continue;
    if (input.trigger === "STATUS_CHANGED" && config(w).status && config(w).status !== input.status) continue;
    const key =
      input.trigger === "STATUS_CHANGED"
        ? `${input.bookingId}:${input.status}`
        : (input.bookingId ?? input.clientId);
    await runOnce(w, key, { clientId: input.clientId, bookingId: input.bookingId });
  }
}

// ─── Disparadores por fecha (se corren periódicamente) ───────────────────────

const ACTIVE_STATUSES: BookingStatus[] = ["INQUIRY", "QUOTED", "BOOKED", "PAID_IN_FULL"];

export async function runDateWorkflows(organizationId: string) {
  const today = todayUTC();
  const workflows = await db.workflow.findMany({
    where: { organizationId, active: true, trigger: { in: DATE_TRIGGERS } },
  });
  let executed = 0;

  for (const w of workflows) {
    const days = config(w).days ?? 0;
    const destinationFilter = w.destinations.length ? { destination: { in: w.destinations } } : {};

    if (w.trigger === "DAYS_BEFORE_TRAVEL") {
      // Corre una vez cuando faltan `days` días o menos (cubre reservas creadas tarde).
      const bookings = await db.booking.findMany({
        where: {
          organizationId,
          status: { in: ACTIVE_STATUSES },
          startDate: { gt: today, lte: addDays(today, days) },
          ...destinationFilter,
        },
      });
      for (const b of bookings) {
        if (await runOnce(w, `${b.id}:${b.startDate!.toISOString().slice(0, 10)}`, { clientId: b.clientId, bookingId: b.id })) executed++;
      }
    }

    if (w.trigger === "DAYS_AFTER_TRAVEL") {
      // Ventana de 14 días para no disparar sobre viajes muy viejos al crear el workflow.
      const bookings = await db.booking.findMany({
        where: {
          organizationId,
          status: { not: "CANCELLED" },
          endDate: { lte: addDays(today, -days), gt: addDays(today, -days - 14) },
          ...destinationFilter,
        },
      });
      for (const b of bookings) {
        if (await runOnce(w, `${b.id}:${b.endDate!.toISOString().slice(0, 10)}`, { clientId: b.clientId, bookingId: b.id })) executed++;
      }
    }

    if (w.trigger === "DAYS_BEFORE_FINAL_PAYMENT") {
      // Un recordatorio por cada reserva confirmada con saldo por vencer.
      const items = await db.bookingItem.findMany({
        where: {
          status: "CONFIRMED",
          balancePaidAt: null,
          balanceDue: { gte: today, lte: addDays(today, days) },
          booking: { organizationId, status: { in: ACTIVE_STATUSES }, ...destinationFilter },
        },
        include: { booking: { select: { clientId: true } } },
      });
      for (const i of items) {
        const key = `${i.id}:${i.balanceDue!.toISOString().slice(0, 10)}`;
        if (await runOnce(w, key, { clientId: i.booking.clientId, bookingId: i.bookingId, bookingItemId: i.id })) executed++;
      }
    }

    if (w.trigger === "DAYS_BEFORE_BIRTHDAY") {
      const travelers = await db.traveler.findMany({
        where: { client: { organizationId }, birthDate: { not: null } },
      });
      for (const t of travelers) {
        const birth = t.birthDate!;
        let next = new Date(Date.UTC(today.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
        if (next < today) next = new Date(Date.UTC(today.getUTCFullYear() + 1, birth.getUTCMonth(), birth.getUTCDate()));
        if (next <= addDays(today, days)) {
          if (await runOnce(w, `${t.id}:${next.getUTCFullYear()}`, { clientId: t.clientId })) executed++;
        }
      }
    }

    if (w.trigger === "PASSPORT_EXPIRING") {
      // Pasaportes que vencen antes de `days` días después del inicio de un viaje próximo.
      const bookings = await db.booking.findMany({
        where: {
          organizationId,
          status: { in: ACTIVE_STATUSES },
          startDate: { gt: today },
          ...destinationFilter,
        },
        include: { travelers: { include: { traveler: true } } },
      });
      for (const b of bookings) {
        const limit = addDays(b.startDate!, days);
        const expiring = b.travelers.filter((bt) => bt.traveler.passportExpiry && bt.traveler.passportExpiry < limit);
        for (const bt of expiring) {
          if (await runOnce(w, `${b.id}:${bt.travelerId}`, { clientId: b.clientId, bookingId: b.id })) executed++;
        }
      }
    }
  }

  await db.organization.update({ where: { id: organizationId }, data: { automationsRunAt: new Date() } });
  return executed;
}

/** Corre las automatizaciones por fecha si pasó más de una hora desde la última vez. */
export async function runDateWorkflowsIfDue(organizationId: string) {
  // Reserva atómica del turno: si dos pedidos llegan juntos, solo uno corre las automatizaciones.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const claimed = await db.organization.updateMany({
    where: { id: organizationId, OR: [{ automationsRunAt: null }, { automationsRunAt: { lt: hourAgo } }] },
    data: { automationsRunAt: new Date() },
  });
  if (claimed.count === 0) return 0;
  return runDateWorkflows(organizationId);
}
