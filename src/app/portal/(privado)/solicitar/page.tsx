import Link from "next/link";
import { requireClientAccount } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { DESTINATIONS } from "@/lib/labels";
import { requestTrip } from "../../actions";

export const metadata = { title: "Pedir un viaje" };

export default async function RequestTrip() {
  const account = await requireClientAccount();
  return (
    <div>
      <Link href="/portal" className="text-sm text-slate-500 hover:text-slate-800">
        ← Mis viajes
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-widest text-amber-600 uppercase">Pedir una cotización</p>
      <h1 className="text-2xl font-semibold text-slate-900">¿A dónde vamos ahora?</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Contale a {account.client.organization.name} qué tenés en mente. Si no sabés las fechas exactas, dejalas en blanco.
      </p>
      <ActionForm action={requestTrip} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <Field label="Destino">
          <Select name="destination" options={DESTINATIONS} defaultValue="DISNEY_WORLD" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde (opcional)">
            <Input type="date" name="startDate" />
          </Field>
          <Field label="Hasta (opcional)">
            <Input type="date" name="endDate" />
          </Field>
          <Field label="Adultos">
            <Input type="number" name="adults" min={1} defaultValue={2} />
          </Field>
          <Field label="Menores">
            <Input type="number" name="children" min={0} defaultValue={0} />
          </Field>
        </div>
        <Field label="¿Qué les gustaría?">
          <Textarea name="notes" rows={4} placeholder="Ej: queremos combinar Disney y Universal, los chicos aman Harry Potter, preferimos hotel con pileta…" />
        </Field>
        <SubmitButton className="w-full" pendingText="Enviando…">
          Enviar pedido
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
