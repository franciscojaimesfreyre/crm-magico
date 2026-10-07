import { ActionForm, SubmitButton, type ActionState } from "@/components/form-controls";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { COMMISSION_STATUS_LABEL, RESERVATION_STATUSES } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import { CommissionInput } from "@/components/commission-input";
import type { BookingItem, FlightLeg } from "@/generated/prisma/client";
import { FlightFields, TripDatesGuard, type FlightLegValues } from "./reservation-extras";
import { ItemTypeSelect } from "@/components/item-type-select";

const COMMISSION_STATUSES = Object.entries(COMMISSION_STATUS_LABEL).map(([value, label]) => ({ value, label }));

/** Formulario completo de una reserva: datos con el proveedor, pagos del cliente y comisión. */
export function ReservationForm({
  action,
  item,
  defaultRate,
  currency,
  trip,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  item?: BookingItem & { flightLegs?: FlightLeg[] };
  /** Fechas del viaje, para avisar si la reserva queda afuera. */
  trip: { startDate: Date | null; endDate: Date | null };
  defaultRate: number;
  currency: string;
  submitLabel: string;
}) {
  const n = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? "" : v.toString());
  const leg = (direction: FlightLeg["direction"]): FlightLegValues | undefined => {
    const l = item?.flightLegs?.find((x) => x.direction === direction);
    return l ? { date: toDateInput(l.date), time: l.time ?? "", airline: l.airline ?? "", flightNumber: l.flightNumber ?? "" } : undefined;
  };
  return (
    <ActionForm action={action} resetOnSuccess={!item} className="space-y-5">
      <TripDatesGuard tripStart={toDateInput(trip.startDate) || null} tripEnd={toDateInput(trip.endDate) || null} />
      <fieldset className="grid gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Reserva</legend>
        <Field label="Tipo">
          <ItemTypeSelect defaultValue={item?.type ?? "DISNEY_WORLD_PACKAGE"} />
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
        <FlightFields outbound={leg("OUTBOUND")} back={leg("RETURN")} />
        <Field label="Detalles" hint="Tipo de habitación, lugar de retiro del auto, equipaje, etc." className="sm:col-span-4">
          <Textarea name="notes" rows={2} defaultValue={item?.notes ?? ""} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Pagos del cliente a este proveedor</legend>
        <Field label="Importe">
          <Input type="number" step="0.01" min={0} name="price" defaultValue={n(item?.price)} required />
        </Field>
        <Field label="Depósito para reservar" hint="Ej: 200 en un paquete Disney">
          <Input type="number" step="0.01" min={0} name="depositAmount" defaultValue={n(item?.depositAmount)} />
        </Field>
        <Field label="Saldar antes del" hint="En paquetes, vacío = 30 días antes de la llegada" className="sm:col-span-2">
          <Input type="date" name="balanceDue" defaultValue={toDateInput(item?.balanceDue)} />
        </Field>
        <p className="self-end pb-2 text-xs text-slate-500 sm:col-span-5">Los pagos (depósito, cuotas y saldo) se registran en la reserva, una vez guardada.</p>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-5">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Comisión</legend>
        <CommissionInput rate={item?.commissionRate?.toString()} fixed={item?.commissionFixed?.toString()} defaultRate={defaultRate} currency={currency} />
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
