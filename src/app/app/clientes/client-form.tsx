import { ActionForm, SubmitButton, type ActionState } from "@/components/form-controls";
import { Card, CardHeader, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { BUDGET_LEVELS, TRIP_PACES } from "@/lib/labels";
import { INTEREST_OPTIONS } from "@/lib/clients";
import type { Client } from "@/generated/prisma/client";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  client?: Client;
  referrers: { id: string; firstName: string; lastName: string }[];
  submitLabel: string;
};

export function ClientForm({ action, client, referrers, submitLabel }: Props) {
  const otherInterests = client?.interests.filter((i) => !INTEREST_OPTIONS.includes(i)) ?? [];
  return (
    <ActionForm action={action} className="space-y-6">
      <Card>
        <CardHeader title="Datos de contacto" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nombre *">
            <Input name="firstName" defaultValue={client?.firstName} required />
          </Field>
          <Field label="Apellido *">
            <Input name="lastName" defaultValue={client?.lastName} required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={client?.email ?? ""} />
          </Field>
          <Field label="Teléfono / WhatsApp">
            <Input name="phone" defaultValue={client?.phone ?? ""} />
          </Field>
          <Field label="Ciudad">
            <Input name="city" defaultValue={client?.city ?? ""} />
          </Field>
          <Field label="País">
            <Input name="country" defaultValue={client?.country ?? ""} />
          </Field>
          <Field label="Etiquetas" hint="Separadas por coma. Ej: VIP, Primera vez, Fan de Star Wars">
            <Input name="tags" defaultValue={client?.tags.join(", ")} />
          </Field>
          <Field label="Referido por">
            <Select
              name="referredById"
              defaultValue={client?.referredById ?? ""}
              options={referrers.filter((r) => r.id !== client?.id).map((r) => ({ value: r.id, label: `${r.firstName} ${r.lastName}` }))}
              placeholder="Nadie"
            />
          </Field>
          <Field label="Notas internas" hint="El cliente nunca ve estas notas" className="sm:col-span-2">
            <Textarea name="notes" defaultValue={client?.notes ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Preferencias de viaje"
          description="La IA usa estos datos para proponer itinerarios a medida."
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Ritmo de viaje">
            <Select name="pace" defaultValue={client?.pace ?? ""} options={TRIP_PACES} placeholder="Sin definir" />
          </Field>
          <Field label="Presupuesto">
            <Select name="budgetLevel" defaultValue={client?.budgetLevel ?? ""} options={BUDGET_LEVELS} placeholder="Sin definir" />
          </Field>
          <div className="sm:col-span-2">
            <span className="label">Intereses</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {INTEREST_OPTIONS.map((i) => (
                <Checkbox key={i} name="interests" value={i} label={i} defaultChecked={client?.interests.includes(i)} />
              ))}
            </div>
            <Input name="otherInterests" className="mt-2" placeholder="Otros intereses, separados por coma" defaultValue={otherInterests.join(", ")} />
          </div>
          <Field label="Parques favoritos" hint="Separados por coma">
            <Input name="favoriteParks" defaultValue={client?.favoriteParks.join(", ")} />
          </Field>
          <Field label="Visitas anteriores">
            <Input name="previousVisits" defaultValue={client?.previousVisits ?? ""} placeholder="Ej: Disney 2019 y 2023, nunca fueron a Universal" />
          </Field>
          <Field label="Alimentación (familia)">
            <Textarea name="dietaryNotes" defaultValue={client?.dietaryNotes ?? ""} placeholder="Celíacos, vegetarianos, alergias…" />
          </Field>
          <Field label="Accesibilidad (familia)">
            <Textarea name="accessibilityNotes" defaultValue={client?.accessibilityNotes ?? ""} placeholder="Cochecito, silla de ruedas, DAS…" />
          </Field>
          <Field label="Otras preferencias" className="sm:col-span-2">
            <Textarea name="preferenceNotes" defaultValue={client?.preferenceNotes ?? ""} placeholder="Ej: prefieren levantarse tarde, aman los desayunos con personajes" />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
