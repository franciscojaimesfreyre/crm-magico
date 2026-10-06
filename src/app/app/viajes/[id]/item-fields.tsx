import { Field, Input, Select } from "@/components/ui";
import { ITEM_TYPES } from "@/lib/labels";
import { toDateInput } from "@/lib/format";

type ItemLike = {
  type: string;
  description: string;
  supplier: string | null;
  confirmationNumber?: string | null;
  startDate: Date | null;
  endDate: Date | null;
  price: { toString(): string };
  commissionRate: { toString(): string } | null;
};

/** Campos de un servicio (reserva o cotización). */
export function ItemFields({ item, defaultRate, withConfirmation = true }: { item?: ItemLike; defaultRate: number; withConfirmation?: boolean }) {
  return (
    <>
      <Field label="Tipo">
        <Select name="type" options={ITEM_TYPES} defaultValue={item?.type ?? "HOTEL"} />
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
      <Field label="Comisión %" hint={`Vacío = ${defaultRate}% por defecto`}>
        <Input type="number" step="0.01" min={0} max={100} name="commissionRate" defaultValue={item?.commissionRate?.toString() ?? ""} />
      </Field>
      {withConfirmation && (
        <Field label="N° de confirmación">
          <Input name="confirmationNumber" defaultValue={item?.confirmationNumber ?? ""} />
        </Field>
      )}
    </>
  );
}
