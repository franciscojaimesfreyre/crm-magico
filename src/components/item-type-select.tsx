import { GroupedSelect } from "@/components/ui";
import { ITEM_TYPE_GROUPS, ITEM_TYPE_LABEL } from "@/lib/labels";

const GROUPS = ITEM_TYPE_GROUPS.map((g) => ({ label: g.label, options: g.types.map((t) => ({ value: t, label: ITEM_TYPE_LABEL[t] })) }));

/** Selector del tipo de reserva o servicio, agrupado por marca (Disney, Universal…) y genéricos. */
export function ItemTypeSelect({ defaultValue }: { defaultValue: string }) {
  return <GroupedSelect name="type" groups={GROUPS} defaultValue={defaultValue} />;
}
