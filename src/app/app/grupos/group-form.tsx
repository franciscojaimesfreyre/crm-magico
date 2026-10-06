import { ActionForm, SubmitButton, type ActionState } from "@/components/form-controls";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { DESTINATIONS, GROUP_STATUSES } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import type { Group } from "@/generated/prisma/client";

export function GroupForm({
  action,
  group,
  clients,
  submitLabel,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  group?: Group;
  clients: { value: string; label: string }[];
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombre *" className="sm:col-span-2">
        <Input name="name" defaultValue={group?.name} placeholder="Ej: Reunión familiar Pérez — Disney 2027" required />
      </Field>
      <Field label="Destino">
        <Select name="destination" options={DESTINATIONS} defaultValue={group?.destination ?? ""} placeholder="Sin definir" />
      </Field>
      <Field label="Estado">
        <Select name="status" options={GROUP_STATUSES} defaultValue={group?.status ?? "PLANNING"} />
      </Field>
      <Field label="Desde">
        <Input type="date" name="startDate" defaultValue={toDateInput(group?.startDate)} />
      </Field>
      <Field label="Hasta">
        <Input type="date" name="endDate" defaultValue={toDateInput(group?.endDate)} />
      </Field>
      <Field label="Organizador" className="sm:col-span-2">
        <Select name="organizerId" options={clients} defaultValue={group?.organizerId ?? ""} placeholder="Sin organizador" />
      </Field>
      <Field label="Descripción" className="sm:col-span-2">
        <Textarea name="description" defaultValue={group?.description ?? ""} />
      </Field>
      <Field label="Notas internas" className="sm:col-span-2">
        <Textarea name="notes" defaultValue={group?.notes ?? ""} />
      </Field>
      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
