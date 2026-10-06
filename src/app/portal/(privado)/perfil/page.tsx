import { db } from "@/lib/db";
import { requireClientAccount } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { TRIP_PACES } from "@/lib/labels";
import { INTEREST_OPTIONS } from "@/lib/clients";
import { toDateInput } from "@/lib/format";
import { updatePortalProfile } from "../../actions";

export const metadata = { title: "Mi familia y preferencias" };

export default async function PortalProfile() {
  const account = await requireClientAccount();
  const client = await db.client.findUniqueOrThrow({
    where: { id: account.clientId },
    include: { travelers: { orderBy: { createdAt: "asc" } } },
  });
  const other = client.interests.filter((i) => !INTEREST_OPTIONS.includes(i));
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Tu familia y tus gustos</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Con esta información tu agente arma itinerarios a tu medida: por ejemplo, qué atracciones pueden hacer los chicos según su altura.
      </p>
      <ActionForm action={updatePortalProfile} className="space-y-5">
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="font-semibold text-slate-900">Quiénes viajan</h2>
          {client.travelers.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
              <p className="pb-2 text-sm font-medium text-slate-800">
                {t.firstName} {t.lastName}
              </p>
              <Field label="Nacimiento">
                <Input type="date" name={`birth-${t.id}`} defaultValue={toDateInput(t.birthDate)} className="w-40" />
              </Field>
              <Field label="Altura (cm)">
                <Input type="number" name={`height-${t.id}`} defaultValue={t.heightCm ?? ""} className="w-24" min={30} max={250} />
              </Field>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2 border-t border-dashed border-slate-200 pt-3">
            <Field label="Agregar a alguien">
              <Input name="newTravelerName" placeholder="Nombre" />
            </Field>
            <Field label="Nacimiento">
              <Input type="date" name="newTravelerBirth" className="w-40" />
            </Field>
            <Field label="Altura (cm)">
              <Input type="number" name="newTravelerHeight" className="w-24" min={30} max={250} />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
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
