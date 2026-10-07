import { GroupedSelect } from "@/components/ui";
import { ITEM_TYPE_GROUPS, ITEM_TYPE_LABEL } from "@/lib/labels";
import type { ItemType } from "@/generated/prisma/enums";

const GROUPS = ITEM_TYPE_GROUPS.map((g) => ({ label: g.label, options: g.types.map((t) => ({ value: t, label: ITEM_TYPE_LABEL[t] })) }));

/**
 * Selector del tipo de reserva o servicio, agrupado por marca (Disney, Universal…) y genéricos.
 * Si el valor actual ya no se ofrece (por ejemplo, "Vuelo" en reservas viejas), se mantiene como opción.
 */
export function ItemTypeSelect({ defaultValue }: { defaultValue: ItemType }) {
  const offered = ITEM_TYPE_GROUPS.some((g) => g.types.includes(defaultValue));
  const groups = offered ? GROUPS : [{ label: "Actual", options: [{ value: defaultValue, label: ITEM_TYPE_LABEL[defaultValue] }] }, ...GROUPS];
  return <GroupedSelect name="type" groups={groups} defaultValue={defaultValue} />;
}
