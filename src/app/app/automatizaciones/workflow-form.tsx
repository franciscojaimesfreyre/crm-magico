import { ActionForm, SubmitButton, type ActionState } from "@/components/form-controls";
import { Card, CardHeader, Checkbox, Field, Input, Select } from "@/components/ui";
import { BOOKING_STATUSES, DESTINATIONS, WORKFLOW_TRIGGERS } from "@/lib/labels";
import { ActionRow } from "./action-row";
import { TEMPLATE_VARIABLES } from "@/lib/templating";
import type { Workflow } from "@/generated/prisma/client";
import type { TriggerConfig, WorkflowAction } from "@/lib/automations";

const ACTION_TYPES = [
  { value: "CREATE_TASK", label: "Crear una tarea" },
  { value: "SEND_EMAIL", label: "Enviar un email al cliente" },
  { value: "SEND_MESSAGE", label: "Enviar un mensaje al portal" },
  { value: "NOTIFY", label: "Notificar al agente" },
  { value: "SEND_FORM", label: "Enviar un formulario al cliente" },
];

const MAX_ACTIONS = 3;

export function WorkflowForm({
  action,
  workflow,
  templates,
  forms = [],
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  workflow?: Workflow;
  templates: { value: string; label: string }[];
  /** Formularios activos, para la acción "Enviar un formulario". */
  forms?: { value: string; label: string }[];
}) {
  const config = (workflow?.triggerConfig ?? {}) as TriggerConfig;
  const actions = (workflow?.actions ?? []) as WorkflowAction[];
  return (
    <ActionForm action={action} className="space-y-6">
      <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <Field label="Nombre *">
          <Input name="name" defaultValue={workflow?.name} required />
        </Field>
        <Field label="Descripción">
          <Input name="description" defaultValue={workflow?.description ?? ""} />
        </Field>
        <Checkbox name="active" label="Activa" defaultChecked={workflow?.active ?? true} />
      </Card>

      <Card>
        <CardHeader title="Cuándo se ejecuta" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <Field label="Disparador">
            <Select name="trigger" options={WORKFLOW_TRIGGERS} defaultValue={workflow?.trigger ?? "DAYS_BEFORE_TRAVEL"} />
          </Field>
          <Field label="Cantidad de días" hint="Para los disparadores por fecha. Pasaporte: días de validez requeridos (ej. 180).">
            <Input type="number" name="days" min={0} defaultValue={config.days ?? 30} />
          </Field>
          <Field label="Nuevo estado" hint="Solo para “El viaje cambia de estado”">
            <Select name="status" options={BOOKING_STATUSES} defaultValue={config.status ?? ""} placeholder="Cualquier estado" />
          </Field>
          <div className="sm:col-span-3">
            <span className="label">Solo para estos destinos (ninguno = todos)</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DESTINATIONS.map((d) => (
                <Checkbox key={d.value} name="destinations" value={d.value} label={d.label} defaultChecked={workflow?.destinations.includes(d.value)} />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Qué hace"
          description={`Hasta ${MAX_ACTIONS} acciones. Podés usar variables como ${TEMPLATE_VARIABLES.slice(0, 3).map((v) => `{{${v.key}}}`).join(", ")}.`}
        />
        <div className="divide-y divide-slate-100">
          {Array.from({ length: MAX_ACTIONS }, (_, i) => (
            <ActionRow key={i} index={i} initial={actions[i]} types={ACTION_TYPES} templates={templates} forms={forms} />
          ))}
        </div>
      </Card>
      <SubmitButton>Guardar automatización</SubmitButton>
    </ActionForm>
  );
}
