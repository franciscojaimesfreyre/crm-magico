import { Field, Input } from "@/components/ui";
import { toDateInput } from "@/lib/format";
import { CommissionInput } from "@/components/commission-input";
import { ItemTypeSelect } from "@/components/item-type-select";
import type { ItemType } from "@/generated/prisma/enums";
import { DateInput } from "@/components/date-input";

type ItemLike = {
  type: ItemType;
  description: string;
  supplier: string | null;
  confirmationNumber?: string | null;
  startDate: Date | null;
  endDate: Date | null;
  price: { toString(): string };
  commissionRate: { toString(): string } | null;
  commissionFixed: { toString(): string } | null;
  depositAmount?: { toString(): string } | null;
  notes?: string | null;
};

/** Campos de un servicio (reserva o cotización). */
export function ItemFields({
  item,
  defaultRate,
  currency,
  withConfirmation = true,
  withDetails = false,
}: {
  item?: ItemLike;
  defaultRate: number;
  currency: string;
  withConfirmation?: boolean;
  /** Depósito y detalles: en la cotización, para que pasen a la reserva al aceptarse y no se carguen dos veces. */
  withDetails?: boolean;
}) {
  return (
    <>
      <Field label="Tipo">
        <ItemTypeSelect defaultValue={item?.type ?? "DISNEY_WORLD_PACKAGE"} />
      </Field>
      <Field label="Descripción *" className="sm:col-span-2">
        <Input name="description" defaultValue={item?.description} placeholder="Ej: Pop Century, habitación estándar, 7 noches" required />
      </Field>
      <Field label="Proveedor">
        <Input name="supplier" defaultValue={item?.supplier ?? ""} placeholder="Disney, Universal, Booking…" />
      </Field>
      <Field label="Desde">
        <DateInput name="startDate" defaultValue={toDateInput(item?.startDate)} />
      </Field>
      <Field label="Hasta">
        <DateInput name="endDate" defaultValue={toDateInput(item?.endDate)} />
      </Field>
      <Field label="Precio">
        <Input type="number" step="0.01" min={0} name="price" defaultValue={item?.price.toString() ?? ""} required />
      </Field>
      <CommissionInput rate={item?.commissionRate?.toString()} fixed={item?.commissionFixed?.toString()} defaultRate={defaultRate} currency={currency} />
      {withDetails && (
        <>
          <Field label="Depósito para reservar" hint="Ej: 200 en un paquete Disney">
            <Input type="number" step="0.01" min={0} name="depositAmount" defaultValue={item?.depositAmount?.toString() ?? ""} />
          </Field>
          <Field label="Detalles" hint="Habitación, retiro del auto, equipaje…" className="sm:col-span-2">
            <Input name="notes" defaultValue={item?.notes ?? ""} />
          </Field>
        </>
      )}
      {withConfirmation && (
        <Field label="N° de confirmación">
          <Input name="confirmationNumber" defaultValue={item?.confirmationNumber ?? ""} />
        </Field>
      )}
    </>
  );
}
