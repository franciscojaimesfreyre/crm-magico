"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import type { ActionState } from "@/components/form-controls";
import type { TaskPriority } from "@/generated/prisma/enums";

function refresh(task: { bookingId: string | null; clientId: string | null }) {
  revalidatePath("/app/tareas");
  revalidatePath("/app");
  if (task.bookingId) revalidatePath(`/app/viajes/${task.bookingId}`);
}

export async function createTask(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Escribí la tarea" };
  const bookingId = String(formData.get("bookingId") ?? "") || null;
  let clientId = String(formData.get("clientId") ?? "") || null;
  if (bookingId) {
    const booking = await db.booking.findFirst({ where: { id: bookingId, organizationId: user.organizationId } });
    if (!booking) return { error: "Viaje no encontrado" };
    clientId = booking.clientId;
  }
  const assigneeId = String(formData.get("assigneeId") ?? "") || user.id;
  const task = await db.task.create({
    data: {
      organizationId: user.organizationId,
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      dueDate: parseDateInput(formData.get("dueDate")),
      priority: (String(formData.get("priority") ?? "MEDIUM") as TaskPriority) || "MEDIUM",
      assigneeId,
      bookingId,
      clientId,
    },
  });
  refresh(task);
  return { ok: "Tarea creada" };
}

export async function toggleTask(id: string) {
  const user = await requireUser();
  const task = await db.task.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!task) return;
  await db.task.update({ where: { id }, data: { completedAt: task.completedAt ? null : new Date() } });
  refresh(task);
}

export async function deleteTask(id: string) {
  const user = await requireUser();
  const task = await db.task.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!task) return;
  await db.task.delete({ where: { id } });
  refresh(task);
}
