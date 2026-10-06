import Link from "next/link";
import clsx from "clsx";
import { Bot, Play } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { BOOKING_STATUS_LABEL, DESTINATION_LABEL, WORKFLOW_TRIGGER_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import type { TriggerConfig, WorkflowAction } from "@/lib/automations";
import { runNow, toggleWorkflow } from "./actions";

export const metadata = { title: "Automatizaciones" };

const ACTION_LABEL: Record<WorkflowAction["type"], string> = {
  CREATE_TASK: "Crea tarea",
  SEND_EMAIL: "Envía email",
  SEND_MESSAGE: "Mensaje al portal",
  NOTIFY: "Notifica",
};

function describeTrigger(trigger: keyof typeof WORKFLOW_TRIGGER_LABEL, config: TriggerConfig) {
  if (trigger === "STATUS_CHANGED") return config.status ? `Pasa a ${BOOKING_STATUS_LABEL[config.status]}` : "Cambia de estado";
  if (trigger === "PASSPORT_EXPIRING") return `Pasaporte con menos de ${config.days ?? 180} días de validez al viajar`;
  if (config.days !== undefined && trigger.startsWith("DAYS_")) return WORKFLOW_TRIGGER_LABEL[trigger].replace("Días", `${config.days} días`);
  return WORKFLOW_TRIGGER_LABEL[trigger];
}

export default async function AutomationsPage() {
  const user = await requireUser();
  const [workflows, runs] = await Promise.all([
    db.workflow.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { runs: true } } },
    }),
    db.workflowRun.findMany({
      where: { workflow: { organizationId: user.organizationId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { workflow: { select: { name: true } } },
    }),
  ]);
  return (
    <>
      <PageHeader
        title="Automatizaciones"
        description="Reglas “si pasa esto, hacé aquello”. Las de fecha se revisan solas cada hora mientras usás el sistema (o con el cron diario)."
        actions={
          <>
            <ActionForm action={runNow}>
              <SubmitButton variant="secondary" pendingText="Ejecutando…">
                <Play className="size-4" /> Ejecutar ahora
              </SubmitButton>
            </ActionForm>
            <LinkButton href="/app/automatizaciones/nueva">Nueva automatización</LinkButton>
          </>
        }
      />
      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workflows.map((w) => {
          const actions = (Array.isArray(w.actions) ? w.actions : []) as WorkflowAction[];
          return (
            <Card key={w.id} className={clsx("flex flex-col p-4", !w.active && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <Link href={`/app/automatizaciones/${w.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                  {w.name}
                </Link>
                <form action={toggleWorkflow.bind(null, w.id)}>
                  <button
                    className={clsx("relative h-5 w-9 rounded-full transition-colors", w.active ? "bg-emerald-500" : "bg-slate-300")}
                    title={w.active ? "Pausar" : "Activar"}
                  >
                    <span className={clsx("absolute top-0.5 size-4 rounded-full bg-white transition-all", w.active ? "left-4.5" : "left-0.5")} />
                  </button>
                </form>
              </div>
              {w.description && <p className="mt-1 text-sm text-slate-500">{w.description}</p>}
              <p className="mt-3 text-xs text-slate-600">⏱ {describeTrigger(w.trigger, (w.triggerConfig ?? {}) as TriggerConfig)}</p>
              {w.destinations.length > 0 && <p className="text-xs text-slate-500">Solo: {w.destinations.map((d) => DESTINATION_LABEL[d]).join(", ")}</p>}
              <div className="mt-3 flex flex-wrap gap-1">
                {actions.map((a, i) => (
                  <Badge key={i} className="bg-brand-50 text-brand-700">
                    {ACTION_LABEL[a.type]}
                  </Badge>
                ))}
              </div>
              <p className="mt-auto pt-3 text-[11px] text-slate-400">{w._count.runs} ejecuciones</p>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader title="Últimas ejecuciones" />
        <ul className="divide-y divide-slate-100 text-sm">
          {runs.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <span className="flex items-center gap-2">
                <Bot className="size-4 text-brand-500" />
                {r.workflow.name}
                {r.bookingId && (
                  <Link href={`/app/viajes/${r.bookingId}`} className="text-xs text-brand-700 hover:underline">
                    ver reserva
                  </Link>
                )}
              </span>
              <span className="flex items-center gap-2 text-xs">
                {r.success ? <Badge className="bg-emerald-100 text-emerald-800">OK</Badge> : <Badge className="bg-rose-100 text-rose-800" >Error: {r.error}</Badge>}
                <span className="text-slate-400">{formatDateTime(r.createdAt)}</span>
              </span>
            </li>
          ))}
          {runs.length === 0 && <li className="px-5 py-3 text-slate-500">Todavía no se ejecutó ninguna.</li>}
        </ul>
      </Card>
    </>
  );
}
