import { ActionForm, SubmitButton, type ActionState } from "@/components/form-controls";
import { Field, Input } from "@/components/ui";
import { toDateInput } from "@/lib/format";
import type { Traveler } from "@/generated/prisma/client";
import { DateInput } from "@/components/date-input";
import { AvatarPicker } from "@/components/avatar-picker";
import type { AvatarImageOption } from "@/lib/avatars";

export function TravelerForm({
  action,
  traveler,
  submitLabel,
  avatarImages = [],
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  traveler?: Traveler;
  submitLabel: string;
  /** Galería de personajes de la agencia (además del set propio). */
  avatarImages?: AvatarImageOption[];
}) {
  return (
    <ActionForm action={action} resetOnSuccess={!traveler} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <div className="sm:col-span-4">
        <AvatarPicker defaultValue={traveler?.avatar} travelerName={traveler?.firstName ?? ""} images={avatarImages} />
      </div>
      <Field label="Nombre *">
        <Input name="firstName" defaultValue={traveler?.firstName} required />
      </Field>
      <Field label="Apellido">
        <Input name="lastName" defaultValue={traveler?.lastName ?? ""} />
      </Field>
      <Field label="Fecha de nacimiento">
        <DateInput name="birthDate" defaultValue={toDateInput(traveler?.birthDate)} />
      </Field>
      <Field label="Altura (cm)" hint="Para restricciones de atracciones">
        <Input name="heightCm" type="number" min={30} max={250} defaultValue={traveler?.heightCm ?? ""} />
      </Field>
      <Field label="Relación">
        <Input name="relationship" defaultValue={traveler?.relationship ?? ""} placeholder="Hijo/a, pareja…" />
      </Field>
      <Field label="Vencimiento del pasaporte">
        <DateInput name="passportExpiry" defaultValue={toDateInput(traveler?.passportExpiry)} />
      </Field>
      <Field label="Alimentación">
        <Input name="dietaryNotes" defaultValue={traveler?.dietaryNotes ?? ""} />
      </Field>
      <Field label="Accesibilidad">
        <Input name="accessibilityNotes" defaultValue={traveler?.accessibilityNotes ?? ""} />
      </Field>
      <Field label="Notas" className="sm:col-span-3">
        <Input name="notes" defaultValue={traveler?.notes ?? ""} />
      </Field>
      <div className="flex items-end">
        <SubmitButton className="w-full">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
