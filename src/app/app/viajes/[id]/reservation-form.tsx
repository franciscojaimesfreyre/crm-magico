import { ActionForm, SubmitButton, type ActionState } from "@/components/form-controls";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { COMMISSION_STATUS_LABEL, ITEM_TYPES, RESERVATION_STATUSES } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import type { BookingItem } from "@/generated/prisma/client";

const COMMISSION_STATUSES = Object.entries(COMMISSION_STATUS_LABEL).map(([value, label]) => ({ value, label }));

/** Formulario completo de una reserva: datos con el proveedor, pagos del cliente y comisión. */
export function ReservationForm({
  action,
  item,
  defaultRate,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  item?: BookingItem;
  defaultRate: number;
  submitLabel: string;
}) {
  const n = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? "" : v.toString());
  return (
    <ActionForm action={action} resetOnSuccess={!item} className="space-y-5">
      <fieldset className="grid gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Reserva</legend>
        <Field label="Tipo">
          <Select name="type" options={ITEM_TYPES} defaultValue={item?.type ?? "PACKAGE"} />
        </Field>
        <Field label="Descripción *" className="sm:col-span-2">
          <Input name="description" defaultValue={item?.description} placeholder="Ej: Paquete Pop Century 7 noches + tickets 5 días" required />
        </Field>
        <Field label="Estado">
          <Select name="status" options={RESERVATION_STATUSES} defaultValue={item?.status ?? "PENDING"} />
        </Field>
        <Field label="Proveedor">
          <Input name="supplier" defaultValue={item?.supplier ?? ""} placeholder="Disney, Universal, Alamo, Booking…" />
        </Field>
        <Field label="N° de confirmación">
          <Input name="confirmationNumber" defaultValue={item?.confirmationNumber ?? ""} />
        </Field>
        <Field label="Desde">
          <Input type="date" name="startDate" defaultValue={toDateInput(item?.startDate)} />
        </Field>
        <Field label="Hasta">
          <Input type="date" name="endDate" defaultValue={toDateInput(item?.endDate)} />
        </Field>
        <Field label="Detalles" hint="Tipo de habitación, lugar de retiro del auto, vuelo, etc." className="sm:col-span-4">
          <Textarea name="notes" rows={2} defaultValue={item?.notes ?? ""} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-5">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Pagos del cliente a este proveedor</legend>
        <Field label="Importe">
          <Input type="number" step="0.01" min={0} name="price" defaultValue={n(item?.price)} required />
        </Field>
        <Field label="Depósito">
          <Input type="number" step="0.01" min={0} name="depositAmount" defaultValue={n(item?.depositAmount)} />
        </Field>
        <Field label="Depósito pagado el">
          <Input type="date" name="depositPaidAt" defaultValue={toDateInput(item?.depositPaidAt)} />
        </Field>
        <Field label="Vence el saldo">
          <Input type="date" name="balanceDue" defaultValue={toDateInput(item?.balanceDue)} />
        </Field>
        <Field label="Saldo pagado el">
          <Input type="date" name="balancePaidAt" defaultValue={toDateInput(item?.balancePaidAt)} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-5">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Comisión</legend>
        <Field label="Comisión %" hint={`Vacío = ${defaultRate}%`}>
          <Input type="number" step="0.01" min={0} max={100} name="commissionRate" defaultValue={n(item?.commissionRate)} />
        </Field>
        <Field label="Fecha de venta" hint="Se completa al confirmar">
          <Input type="date" name="saleDate" defaultValue={toDateInput(item?.saleDate)} />
        </Field>
        <Field label="Estado de cobro">
          <Select name="commissionStatus" options={COMMISSION_STATUSES} defaultValue={item?.commissionStatus ?? "PENDING"} />
        </Field>
        <Field label="Cobrada el">
          <Input type="date" name="commissionPaidAt" defaultValue={toDateInput(item?.commissionPaidAt)} />
        </Field>
        <Field label="Monto cobrado" hint="Vacío = el esperado">
          <Input type="number" step="0.01" min={0} name="commissionPaidAmount" defaultValue={n(item?.commissionPaidAmount)} />
        </Field>
        <Field label="Notas de la comisión" className="sm:col-span-5">
          <Input name="commissionNotes" defaultValue={item?.commissionNotes ?? ""} />
        </Field>
      </fieldset>

      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
