import { ActionForm, SubmitButton, type ActionState } from "@/components/form-controls";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { COMMISSION_STATUS_LABEL, RESERVATION_STATUSES } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import { CommissionInput } from "@/components/commission-input";
import { MultiFileUpload } from "@/components/file-upload";
import { AttachmentChips } from "@/components/attachment-chips";
import type { BookingItem } from "@/generated/prisma/client";
import { PriceWithTax, ReservationTravelers, TripDatesGuard, type TravelerOption } from "./reservation-extras";
import { ItemTypeSelect } from "@/components/item-type-select";
import { DateInput } from "@/components/date-input";


/**
 * Formulario completo de una reserva: datos con el proveedor, viajeros incluidos, totales a pagar,
 * comisión y documentos. Al crearla la comisión queda pendiente: el cobro se registra después, al editarla.
 */
export function ReservationForm({
  action,
  item,
  defaultRate,
  currency,
  trip,
  travelers,
  selectedTravelers,
  directUpload,
  documents = [],
  agencyShare,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  item?: BookingItem;
  /** Fechas del viaje, para avisar si la reserva queda afuera. */
  trip: { startDate: Date | null; endDate: Date | null };
  /** Viajeros del cliente y los que van marcados (al crear, los del viaje). */
  travelers: TravelerOption[];
  selectedTravelers: string[];
  /** Subida directa a R2 (ver FileUpload). */
  directUpload: boolean;
  /** Reparto con la agencia host: su % y si el agente puede cambiarlo por reserva (solo si la agencia es propia). */
  agencyShare?: { percent: number | null; editable: boolean };
  /** Adjuntos que ya tiene la reserva (al editar). */
  documents?: { id: string; name: string; storageKey: string | null; url: string | null; mimeType: string | null }[];
  defaultRate: number;
  currency: string;
  submitLabel: string;
}) {
  const n = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? "" : v.toString());
  return (
    <ActionForm action={action} resetOnSuccess={!item} className="space-y-5">
      <TripDatesGuard tripStart={toDateInput(trip.startDate) || null} tripEnd={toDateInput(trip.endDate) || null} />
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-xs font-semibold text-slate-500">Reserva</legend>
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
          <DateInput name="startDate" defaultValue={toDateInput(item?.startDate)} />
        </Field>
        <Field label="Hasta">
          <DateInput name="endDate" defaultValue={toDateInput(item?.endDate)} />
        </Field>
        <Field label="Detalles" hint="Tipo de habitación, lugar de retiro del auto, equipaje, etc." className="sm:col-span-4">
          <Textarea name="notes" rows={2} defaultValue={item?.notes ?? ""} />
        </Field>
      </fieldset>

      <ReservationTravelers travelers={travelers} selected={selectedTravelers} required={!item} />

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-xs font-semibold text-slate-500">Totales a pagar</legend>
        <PriceWithTax price={n(item?.price)} tax={n(item?.taxAmount)} currency={currency} />
        <Field label="Depósito para reservar" hint="Ej: 200 en un paquete Disney">
          <Input type="number" step="0.01" min={0} name="depositAmount" defaultValue={n(item?.depositAmount)} />
        </Field>
        <Field label="Saldar antes del" hint="En paquetes, vacío = 30 días antes de la llegada">
          <DateInput name="balanceDue" defaultValue={toDateInput(item?.balanceDue)} />
        </Field>
        <p className="self-end pb-2 text-xs text-slate-500 sm:col-span-4">Los pagos (depósito, cuotas y saldo) se registran en la reserva, una vez guardada.</p>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <legend className="mb-2 text-xs font-semibold text-slate-500">Comisión</legend>
        <CommissionInput rate={item?.commissionRate?.toString()} fixed={item?.commissionFixed?.toString()} defaultRate={defaultRate} currency={currency} />
        {agencyShare?.editable && (
          <Field label="Tu parte (%)" hint={`De la comisión del proveedor. Vacío = el de tu agencia (${agencyShare.percent ?? 100} %)`}>
            <Input name="agentSharePercent" type="number" step="0.01" min={0} max={100} defaultValue={item?.agentSharePercent?.toString() ?? ""} placeholder={String(agencyShare.percent ?? 100)} />
          </Field>
        )}
        <Field label="Fecha de venta" hint="Se completa al confirmar">
          <DateInput name="saleDate" defaultValue={toDateInput(item?.saleDate)} />
        </Field>
        {item ? (
          // El cobro se registra en un solo lugar (Comisiones y sus planillas), para que todo cuadre.
          <div className="self-end pb-2 text-xs text-slate-600 sm:col-span-3">
            Cobro: <span className="font-medium text-slate-800">{COMMISSION_STATUS_LABEL[item.commissionStatus]}</span>
            {item.commissionPaidAt && ` el ${formatDate(item.commissionPaidAt)}`}
            {" · "}
            <Link href="/app/comisiones" className="font-medium text-brand-700 hover:underline">
              Se marca en Comisiones
            </Link>
          </div>
        ) : (
          <p className="self-end pb-2 text-xs text-slate-500 sm:col-span-3">La comisión queda pendiente de cobro. Cuando la cobres, la registrás en Comisiones.</p>
        )}
        <Field label="Notas de la comisión" className="sm:col-span-5">
          <Input name="commissionNotes" defaultValue={item?.commissionNotes ?? ""} />
        </Field>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold text-slate-500">{item ? "Agregar documentos" : "Documentos"}</legend>
        <p className="text-xs text-slate-500">Voucher, recibos, confirmaciones… Quedan también en la pestaña Documentos del viaje, asociados a esta reserva.</p>
        {documents.length > 0 && (
          <div className="text-xs text-slate-600">
            <span className="font-medium">Ya tiene ({documents.length}):</span>
            <AttachmentChips docs={documents} removable insideForm />
          </div>
        )}
        <MultiFileUpload direct={directUpload} />
        <Checkbox name="docsVisibleToClient" label="Visibles para el cliente en su portal" defaultChecked />
      </fieldset>

      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
