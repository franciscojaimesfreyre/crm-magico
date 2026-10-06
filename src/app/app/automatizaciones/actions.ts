"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { runDateWorkflows, type TriggerConfig, type WorkflowAction } from "@/lib/automations";
import type { ActionState } from "@/components/form-controls";
import type { BookingStatus, Destination, TaskPriority, WorkflowTrigger } from "@/generated/prisma/enums";

const MAX_ACTIONS = 3;

function parse(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const trigger = str("trigger") as WorkflowTrigger;
  const triggerConfig: TriggerConfig = {};
  const days = Number(str("days"));
  if (Number.isFinite(days) && str("days") !== "") triggerConfig.days = Math.max(0, Math.round(days));
  if (trigger === "STATUS_CHANGED" && str("status")) triggerConfig.status = str("status") as BookingStatus;

  const actions: WorkflowAction[] = [];
  for (let i = 0; i < MAX_ACTIONS; i++) {
    const type = str(`a${i}_type`);
    if (type === "CREATE_TASK" && str(`a${i}_title`)) {
      actions.push({ type, title: str(`a${i}_title`), priority: (str(`a${i}_priority`) || "MEDIUM") as TaskPriority, dueInDays: Number(str(`a${i}_due`) || 0) });
    } else if (type === "SEND_EMAIL" && str(`a${i}_template`)) {
      actions.push({ type, templateId: str(`a${i}_template`) });
    } else if (type === "SEND_MESSAGE" && str(`a${i}_body`)) {
      actions.push({ type, body: str(`a${i}_body`) });
    } else if (type === "NOTIFY" && str(`a${i}_title`)) {
      actions.push({ type, title: str(`a${i}_title`) });
    }
  }
  return {
    name: str("name"),
    description: str("description") || null,
    trigger,
    triggerConfig,
    destinations: formData.getAll("destinations").map(String) as Destination[],
    actions,
    active: formData.get("active") === "on",
  };
}

export async function saveWorkflow(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const data = parse(formData);
  if (!data.name) return { error: "Poné un nombre" };
  if (data.actions.length === 0) return { error: "Agregá al menos una acción completa" };
  if (id) {
    const res = await db.workflow.updateMany({ where: { id, organizationId: user.organizationId }, data });
    if (res.count === 0) return { error: "Automatización no encontrada" };
  } else {
    await db.workflow.create({ data: { ...data, organizationId: user.organizationId } });
  }
  redirect("/app/automatizaciones");
}

export async function toggleWorkflow(id: string) {
  const user = await requireUser();
  const w = await db.workflow.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!w) return;
  await db.workflow.update({ where: { id }, data: { active: !w.active } });
  revalidatePath("/app/automatizaciones");
}

export async function deleteWorkflow(id: string) {
  const user = await requireUser();
  await db.workflow.deleteMany({ where: { id, organizationId: user.organizationId } });
  redirect("/app/automatizaciones");
}

export async function runNow(_: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const executed = await runDateWorkflows(user.organizationId);
  revalidatePath("/app/automatizaciones");
  return { ok: executed ? `Se ejecutaron ${executed} automatizaciones.` : "No había nada pendiente para ejecutar." };
}
