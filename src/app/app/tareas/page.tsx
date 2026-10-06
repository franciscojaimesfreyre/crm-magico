import Link from "next/link";
import clsx from "clsx";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { TaskForm } from "@/components/task-form";
import { TaskList } from "@/components/task-list";
import { addDays, todayUTC } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Tareas" };

const FILTERS = [
  { key: "", label: "Pendientes" },
  { key: "vencidas", label: "Vencidas" },
  { key: "semana", label: "Esta semana" },
  { key: "hechas", label: "Completadas" },
];

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ ver?: string; todos?: string }> }) {
  const user = await requireUser();
  const { ver = "", todos } = await searchParams;
  const today = todayUTC();
  const where: Prisma.TaskWhereInput = { organizationId: user.organizationId };
  if (!todos) where.OR = [{ assigneeId: user.id }, { assigneeId: null }];
  if (ver === "hechas") where.completedAt = { not: null };
  else {
    where.completedAt = null;
    if (ver === "vencidas") where.dueDate = { lt: today };
    if (ver === "semana") where.dueDate = { lte: addDays(today, 7) };
  }
  const [tasks, agents] = await Promise.all([
    db.task.findMany({
      where,
      orderBy: ver === "hechas" ? { completedAt: "desc" } : [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
      take: 300,
      include: {
        assignee: { select: { name: true } },
        booking: { select: { id: true, code: true, title: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    db.user.findMany({ where: { organizationId: user.organizationId, active: true }, select: { id: true, name: true } }),
  ]);
  const href = (k: string, all = todos) => `/app/tareas?${new URLSearchParams({ ...(k ? { ver: k } : {}), ...(all ? { todos: "1" } : {}) })}`;
  return (
    <>
      <PageHeader title="Tareas" description="Las tareas con el ícono de robot las creó una automatización." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link key={f.key} href={href(f.key)} className={clsx("rounded-full px-3 py-1 text-xs font-medium", ver === f.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}>
              {f.label}
            </Link>
          ))}
        </div>
        {agents.length > 1 && (
          <Link href={href(ver, todos ? undefined : "1")} className="text-xs text-brand-700 hover:underline">
            {todos ? "Ver solo las mías" : "Ver las de todo el equipo"}
          </Link>
        )}
      </div>
      <Card>
        <CardHeader title="Nueva tarea" />
        <TaskForm agents={agents.map((a) => ({ value: a.id, label: a.name }))} />
        <div className="border-t border-slate-100">
          <TaskList tasks={tasks} />
        </div>
      </Card>
    </>
  );
}
