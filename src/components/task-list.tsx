import Link from "next/link";
import clsx from "clsx";
import { Bot, Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { ConfirmButton } from "@/components/form-controls";
import { TASK_PRIORITY_LABEL } from "@/lib/labels";
import { daysBetween, formatDate, todayUTC } from "@/lib/format";
import { deleteTask, toggleTask } from "@/app/app/tareas/actions";
import type { TaskPriority } from "@/generated/prisma/enums";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: TaskPriority;
  completedAt: Date | null;
  automated: boolean;
  assignee?: { name: string } | null;
  booking?: { id: string; code: string; title: string } | null;
  client?: { id: string; firstName: string; lastName: string } | null;
};

// Solo la prioridad alta se destaca; el rojo queda para lo atrasado.
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  HIGH: "bg-amber-100 text-amber-900",
  MEDIUM: "bg-slate-100 text-slate-700",
  LOW: "bg-slate-50 text-slate-600",
};

export function TaskList({ tasks, showContext = true }: { tasks: TaskRow[]; showContext?: boolean }) {
  const today = todayUTC();
  if (tasks.length === 0) return <p className="p-5 text-sm text-[var(--ink-soft)]">No hay tareas pendientes.</p>;
  return (
    <ul className="divide-y divide-[var(--rule)]">
      {tasks.map((t) => {
        const diff = t.dueDate ? daysBetween(today, t.dueDate) : null;
        const overdue = !t.completedAt && diff !== null && diff < 0;
        return (
          <li key={t.id} className="flex items-start gap-3 px-5 py-3">
            <form action={toggleTask.bind(null, t.id)} className="pt-0.5">
              <button
                className={clsx(
                  "t-press flex size-5 items-center justify-center rounded-full border-2",
                  t.completedAt ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-brand-500",
                )}
                title={t.completedAt ? "Marcar pendiente" : "Completar"}
              >
                {t.completedAt && <Check className="t-check size-3" strokeWidth={3} />}
              </button>
            </form>
            <div className="min-w-0 flex-1">
              <p className={clsx("text-sm", t.completedAt ? "text-slate-500 line-through" : "text-slate-800")}>
                {t.automated && <Bot className="mr-1 inline size-3.5 text-brand-500" aria-label="Creada por una automatización" />}
                {t.title}
              </p>
              {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge className={PRIORITY_COLOR[t.priority]}>{TASK_PRIORITY_LABEL[t.priority]}</Badge>
                {t.dueDate && (
                  <span className={clsx("tabular-nums", overdue && "font-medium text-rose-700")}>
                    {overdue ? "Venció" : "Vence"} {formatDate(t.dueDate)}
                    {diff === 0 && !t.completedAt && " (hoy)"}
                  </span>
                )}
                {showContext && t.booking && (
                  <Link className="text-brand-700 hover:underline" href={`/app/viajes/${t.booking.id}`}>
                    {t.booking.code} · {t.booking.title}
                  </Link>
                )}
                {showContext && !t.booking && t.client && (
                  <Link className="text-brand-700 hover:underline" href={`/app/clientes/${t.client.id}`}>
                    {t.client.firstName} {t.client.lastName}
                  </Link>
                )}
                {t.assignee && <span>· {t.assignee.name}</span>}
              </div>
            </div>
            <form action={deleteTask.bind(null, t.id)}>
              <ConfirmButton variant="ghost" message="¿Eliminar la tarea?">
                <Trash2 className="size-3.5" />
              </ConfirmButton>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
