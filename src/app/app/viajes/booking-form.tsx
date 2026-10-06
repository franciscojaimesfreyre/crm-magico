import { ActionForm, SubmitButton, type ActionState } from "@/components/form-controls";
import { Card, CardHeader, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { BOOKING_STATUSES, DESTINATIONS } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import type { Booking } from "@/generated/prisma/client";

type Opt = { value: string; label: string };

export function BookingForm({
  action,
  booking,
  clients,
  defaultClientId,
  groups,
  defaultCurrency,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  booking?: Booking;
  clients?: Opt[];
  defaultClientId?: string;
  groups: Opt[];
  defaultCurrency: string;
  submitLabel: string;
}) {
  const n = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return (
    <ActionForm action={action} className="space-y-6">
      <Card>
        <CardHeader title="Viaje" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {clients && (
            <Field label="Cliente *" className="lg:col-span-2">
              <Select name="clientId" options={clients} defaultValue={defaultClientId} placeholder="Elegí un cliente" required />
            </Field>
          )}
          <Field label="Título" hint="Si lo dejás vacío se arma solo" className={clients ? "" : "lg:col-span-2"}>
            <Input name="title" defaultValue={booking?.title} placeholder="Ej: Disney 2027 — familia Pérez" />
          </Field>
          <Field label="Destino *">
            <Select name="destination" options={DESTINATIONS} defaultValue={booking?.destination ?? "DISNEY_WORLD"} />
          </Field>
          <Field label="Estado">
            <Select name="status" options={BOOKING_STATUSES} defaultValue={booking?.status ?? "INQUIRY"} />
          </Field>
          <Field label="Grupo">
            <Select name="groupId" options={groups} defaultValue={booking?.groupId ?? ""} placeholder="Sin grupo" />
          </Field>
          <Field label="Desde">
            <Input type="date" name="startDate" defaultValue={toDateInput(booking?.startDate)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" name="endDate" defaultValue={toDateInput(booking?.endDate)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adultos">
              <Input type="number" min={0} name="adults" defaultValue={booking?.adults ?? 2} />
            </Field>
            <Field label="Menores">
              <Input type="number" min={0} name="children" defaultValue={booking?.children ?? 0} />
            </Field>
          </div>
          <Field label="Moneda">
            <Select name="currency" defaultValue={booking?.currency ?? defaultCurrency} options={["USD", "EUR", "ARS", "MXN", "CLP", "COP", "BRL", "UYU"].map((c) => ({ value: c, label: c }))} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Detalle de parques y hotel" description="Opcional: datos generales para el itinerario y la IA. Los importes, pagos y comisiones se cargan en cada reserva del viaje." />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Hotel / resort">
            <Input name="resort" defaultValue={n(booking?.resort)} placeholder="Ej: Disney's Pop Century Resort" />
          </Field>
          <Field label="Tipo de habitación">
            <Input name="roomType" defaultValue={n(booking?.roomType)} />
          </Field>
          <Field label="Plan de comidas">
            <Input name="diningPlan" defaultValue={n(booking?.diningPlan)} />
          </Field>
          <Field label="Tipo de entrada">
            <Input name="ticketType" defaultValue={n(booking?.ticketType)} placeholder="Ej: Park Hopper" />
          </Field>
          <Field label="Días de parque">
            <Input type="number" min={0} name="parkDays" defaultValue={n(booking?.parkDays)} />
          </Field>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <Checkbox name="lightningLane" label="Lightning Lane" defaultChecked={booking?.lightningLane} />
            <Checkbox name="memoryMaker" label="Memory Maker" defaultChecked={booking?.memoryMaker} />
          </div>
        </div>
      </Card>


      <Card>
        <CardHeader title="Notas" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Notas internas" hint="Solo las ves vos">
            <Textarea name="notes" defaultValue={n(booking?.notes)} rows={4} />
          </Field>
          <Field label="Notas para el cliente" hint="Se muestran en el portal">
            <Textarea name="clientNotes" defaultValue={n(booking?.clientNotes)} rows={4} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
