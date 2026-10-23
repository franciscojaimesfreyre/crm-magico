import { db } from "@/lib/db";
import { requireClientAccount } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { TRIP_PACES } from "@/lib/labels";
import { INTEREST_OPTIONS } from "@/lib/clients";
import { toDateInput } from "@/lib/format";
import { updatePortalProfile } from "../../actions";
import { DateInput } from "@/components/date-input";
import { AvatarPicker } from "@/components/avatar-picker";
import { avatarImages } from "@/lib/avatars-server";

export const metadata = { title: "Mi familia y preferencias" };

export default async function PortalProfile() {
  const account = await requireClientAccount();
  const client = await db.client.findUniqueOrThrow({
    where: { id: account.clientId },
    include: { travelers: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  const gallery = await avatarImages(client.organizationId);
  const other = client.interests.filter((i) => !INTEREST_OPTIONS.includes(i));
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Tu familia y tus gustos</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Con esta información tu agente arma itinerarios a tu medida: por ejemplo, qué atracciones pueden hacer los chicos según su altura.
      </p>
      <ActionForm action={updatePortalProfile} className="space-y-5">
        <section className="space-y-3 rounded-2xl bg-white p-5 border border-[var(--border)]">
          <h2 className="font-semibold text-slate-900">Quiénes viajan</h2>
          <p className="-mt-1 text-sm text-slate-500">Tocá el personaje de cada uno para cambiarlo.</p>
          {/* En el teléfono: personaje y nombre arriba, los datos debajo; en pantallas anchas, todo en una fila. */}
          {client.travelers.map((t) => (
            <div key={t.id} className="grid grid-cols-2 items-end gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_11rem_7rem]">
              <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                <AvatarPicker compact name={`avatar-${t.id}`} defaultValue={t.avatar} travelerName={t.firstName} images={gallery} />
                <p className="text-sm font-semibold text-slate-900">
                  {t.firstName} {t.lastName}
                </p>
              </div>
              <Field label="Nacimiento">
                <DateInput name={`birth-${t.id}`} defaultValue={toDateInput(t.birthDate)} />
              </Field>
              <Field label="Altura (cm)">
                <Input type="number" name={`height-${t.id}`} defaultValue={t.heightCm ?? ""} min={30} max={250} />
              </Field>
            </div>
          ))}
          <div className="grid grid-cols-2 items-end gap-x-3 gap-y-2 border-t border-dashed border-slate-200 pt-4 sm:grid-cols-[minmax(0,1fr)_11rem_7rem]">
            <div className="col-span-2 flex items-end gap-3 sm:col-span-1">
              <AvatarPicker compact name="newTravelerAvatar" travelerName="" images={gallery} />
              <Field label="Agregar a alguien" className="flex-1">
                <Input name="newTravelerName" placeholder="Nombre" />
              </Field>
            </div>
            <Field label="Nacimiento">
              <DateInput name="newTravelerBirth" />
            </Field>
            <Field label="Altura (cm)">
              <Input type="number" name="newTravelerHeight" min={30} max={250} />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-5 border border-[var(--border)]">
          <h2 className="font-semibold text-slate-900">Cómo les gusta viajar</h2>
          <Field label="Ritmo">
            <Select name="pace" options={TRIP_PACES} defaultValue={client.pace ?? ""} placeholder="Elegí uno" />
          </Field>
          <div>
            <span className="label">Les encanta…</span>
            <div className="grid grid-cols-2 gap-2">
              {INTEREST_OPTIONS.map((i) => (
                <Checkbox key={i} name="interests" value={i} label={i} defaultChecked={client.interests.includes(i)} />
              ))}
            </div>
            <Input name="otherInterests" className="mt-2" placeholder="Otros, separados por coma" defaultValue={other.join(", ")} />
          </div>
          <Field label="Alimentación (alergias, celiaquía, vegetarianos…)">
            <Textarea name="dietaryNotes" defaultValue={client.dietaryNotes ?? ""} />
          </Field>
          <Field label="Accesibilidad (cochecito, silla de ruedas…)">
            <Textarea name="accessibilityNotes" defaultValue={client.accessibilityNotes ?? ""} />
          </Field>
          <Field label="Algo más que debamos saber">
            <Textarea name="preferenceNotes" defaultValue={client.preferenceNotes ?? ""} placeholder="Ej: aman los desayunos con personajes, no les gustan las alturas" />
          </Field>
          <Field label="Teléfono / WhatsApp">
            <Input name="phone" defaultValue={client.phone ?? ""} />
          </Field>
        </section>
        <SubmitButton className="w-full">Guardar</SubmitButton>
      </ActionForm>
    </div>
  );
}
