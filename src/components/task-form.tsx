import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Input, Select } from "@/components/ui";
import { TASK_PRIORITIES } from "@/lib/labels";
import { createTask } from "@/app/app/tareas/actions";

export function TaskForm({
  bookingId,
  clientId,
  agents,
}: {
  bookingId?: string;
  clientId?: string;
  agents?: { value: string; label: string }[];
}) {
  return (
    <ActionForm action={createTask} resetOnSuccess className="flex flex-wrap items-end gap-2 p-4">
      {bookingId && <input type="hidden" name="bookingId" value={bookingId} />}
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      <Input name="title" placeholder="Nueva tarea…" required className="min-w-56 flex-1" />
      <Input type="date" name="dueDate" className="w-40" />
      <Select name="priority" options={TASK_PRIORITIES} defaultValue="MEDIUM" className="w-28" />
      {agents && agents.length > 1 && <Select name="assigneeId" options={agents} placeholder="Yo" className="w-40" />}
      <SubmitButton size="md">Agregar</SubmitButton>
    </ActionForm>
  );
}
