import { Field, Input } from "@/components/ui";
import { toDateInput } from "@/lib/format";
import { CommissionInput } from "@/components/commission-input";
import { ItemTypeSelect } from "@/components/item-type-select";
import type { ItemType } from "@/generated/prisma/enums";

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
};

/** Campos de un servicio (reserva o cotización). */
export function ItemFields({
  item,
  defaultRate,
  currency,
  withConfirmation = true,
}: {
  item?: ItemLike;
  defaultRate: number;
  currency: string;
  withConfirmation?: boolean;
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
        <Input type="date" name="startDate" defaultValue={toDateInput(item?.startDate)} />
      </Field>
      <Field label="Hasta">
        <Input type="date" name="endDate" defaultValue={toDateInput(item?.endDate)} />
      </Field>
      <Field label="Precio">
        <Input type="number" step="0.01" min={0} name="price" defaultValue={item?.price.toString() ?? ""} required />
      </Field>
      <CommissionInput rate={item?.commissionRate?.toString()} fixed={item?.commissionFixed?.toString()} defaultRate={defaultRate} currency={currency} />
      {withConfirmation && (
        <Field label="N° de confirmación">
          <Input name="confirmationNumber" defaultValue={item?.confirmationNumber ?? ""} />
        </Field>
      )}
    </>
  );
}
