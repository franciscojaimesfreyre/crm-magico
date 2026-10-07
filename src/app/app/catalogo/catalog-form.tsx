"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, type ActionState } from "@/components/form-controls";
import { Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { CATALOG_KINDS, DESTINATIONS, DINING_STYLES, PRICE_LEVELS } from "@/lib/labels";
import type { CatalogKind } from "@/generated/prisma/enums";

export type CatalogFormValues = {
  kind: CatalogKind;
  destination: string;
  area: string;
  name: string;
  minHeightIn: string;
  diningStyle: string;
  priceLevel: string;
  notes: string;
  closedFrom: string;
  closedTo: string;
  mustDo: boolean;
};

/** Alta y edición de un lugar del catálogo. Los campos cambian según el tipo. */
export function CatalogForm({
  action,
  values,
  areas,
  submitLabel,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  values?: CatalogFormValues;
  areas: string[];
  submitLabel: string;
}) {
  const [kind, setKind] = useState<CatalogKind>(values?.kind ?? "ATTRACTION");
  const [inches, setInches] = useState(values?.minHeightIn ?? "");
  const cm = Number(inches) > 0 ? Math.ceil(Number(inches) * 2.54) : null;

  return (
    <ActionForm action={action}>
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Tipo">
          <Select name="kind" options={CATALOG_KINDS} value={kind} onChange={(e) => setKind(e.target.value as CatalogKind)} />
        </Field>
        <Field label="Destino *">
          <Select name="destination" options={DESTINATIONS} defaultValue={values?.destination ?? "DISNEY_WORLD"} required />
        </Field>
        <Field label="Parque o zona *" hint="Magic Kingdom, EPCOT, Disney Springs, CityWalk, un hotel, Orlando…">
          <Input name="area" list="catalog-areas" defaultValue={values?.area} required />
          <datalist id="catalog-areas">
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
        <Field label="Nombre *" hint="Como figura en la página oficial">
          <Input name="name" defaultValue={values?.name} required />
        </Field>
        {kind === "ATTRACTION" && (
          <Field label="Altura mínima (pulgadas)" hint={cm ? `= ${cm} cm. Vacío si no tiene.` : "Como la publican Disney y Universal. Vacío si no tiene."}>
            <Input name="minHeightIn" type="number" min={20} max={70} value={inches} onChange={(e) => setInches(e.target.value)} />
          </Field>
        )}
        {kind === "RESTAURANT" && (
          <Field label="Tipo de restaurante">
            <Select name="diningStyle" options={DINING_STYLES} defaultValue={values?.diningStyle ?? ""} placeholder="—" />
          </Field>
        )}
        {(kind === "RESTAURANT" || kind === "SHOPPING") && (
          <Field label="Precio" hint="La IA lo cruza con el presupuesto del cliente">
            <Select name="priceLevel" options={PRICE_LEVELS} defaultValue={values?.priceLevel ?? ""} placeholder="—" />
          </Field>
        )}
        <Field label="Notas" hint="Lo que conviene saber: personajes, si te mojás, entrada aparte…" className="sm:col-span-2">
          <Textarea name="notes" rows={2} defaultValue={values?.notes} />
        </Field>
        <Field label="Cerrada desde" hint="Remodelación o cierre temporal">
          <Input type="date" name="closedFrom" defaultValue={values?.closedFrom} />
        </Field>
        <Field label="Reabre" hint="Vacío si no hay fecha confirmada">
          <Input type="date" name="closedTo" defaultValue={values?.closedTo} />
        </Field>
        {(kind === "ATTRACTION" || kind === "SHOW") && (
          <div className="sm:col-span-2">
            <Checkbox name="mustDo" label="Imperdible: se suma siempre al itinerario de este parque" defaultChecked={values?.mustDo} />
          </div>
        )}
        <div className="sm:col-span-2">
          <Checkbox name="verified" label="Lo revisé contra la página oficial" defaultChecked={!values} />
        </div>
      </Card>
      <div className="mt-4 flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
