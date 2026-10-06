import { Building2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Card, CardHeader, Field, Input, PageHeader, Select, Tabs, Textarea } from "@/components/ui";
import { formatDate, percent } from "@/lib/format";
import { isPlatformAgency } from "@/lib/agencies";
import {
  joinAgencyWithCode,
  leaveCurrentAgency,
  regenerateIcalToken,
  saveMyAgency,
  updateMyAccount,
  updateOrganization,
} from "./actions";

export const metadata = { title: "Configuración" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { tab = "negocio" } = await searchParams;
  const org = user.organization;
  const agency = org.agency;
  const tabs = [
    { key: "negocio", label: "Mi negocio" },
    { key: "agencia", label: "Mi agencia" },
    { key: "cuenta", label: "Mi cuenta" },
  ];

  return (
    <div className="max-w-4xl">
      <PageHeader title="Configuración" />
      <Tabs active={tab} tabs={tabs.map((t) => ({ ...t, href: `/app/configuracion?tab=${t.key}` }))} />

      {tab === "negocio" && (
        <Card>
          <CardHeader title="Datos del negocio" description="Se muestran en el portal del cliente, el formulario de cotización y los emails." />
          <ActionForm action={updateOrganization} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nombre">
              <Input name="name" defaultValue={org.name} required />
            </Field>
            <Field label="Código de marketing" hint={`Tu formulario: /cotizar/${org.marketingCode}`}>
              <Input name="marketingCode" defaultValue={org.marketingCode} className="uppercase" />
            </Field>
            <Field label="Frase / tagline" className="sm:col-span-2">
              <Input name="tagline" defaultValue={org.tagline ?? ""} maxLength={120} />
            </Field>
            <Field label="Bio" className="sm:col-span-2">
              <Textarea name="bio" defaultValue={org.bio ?? ""} />
            </Field>
            <Field label="Email de contacto">
              <Input name="contactEmail" type="email" defaultValue={org.contactEmail ?? ""} />
            </Field>
            <Field label="Teléfono / WhatsApp">
              <Input name="contactPhone" defaultValue={org.contactPhone ?? ""} />
            </Field>
            <Field label="Logo (URL de la imagen)">
              <Input name="logoUrl" type="url" defaultValue={org.logoUrl ?? ""} placeholder="https://" />
            </Field>
            <Field label="Color principal">
              <Input name="primaryColor" type="color" defaultValue={org.primaryColor} className="h-10 p-1" />
            </Field>
            <Field label="Moneda por defecto">
              <Select name="defaultCurrency" defaultValue={org.defaultCurrency} options={["USD", "EUR", "ARS", "MXN", "CLP", "COP", "BRL", "UYU"].map((c) => ({ value: c, label: c }))} />
            </Field>
            <Field label="Comisión por defecto (%)" hint="Se usa si tu agencia o el servicio no tienen una propia">
              <Input name="defaultCommissionRate" type="number" step="0.01" min={0} max={100} defaultValue={org.defaultCommissionRate.toString()} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Guardar</SubmitButton>
            </div>
          </ActionForm>
          <div className="border-t border-slate-100 p-5 text-sm">
            <p className="font-medium text-slate-800">Link privado del calendario (iCal)</p>
            <p className="mb-2 text-xs text-slate-500">Si se filtró, generá uno nuevo: el anterior deja de funcionar.</p>
            <form action={regenerateIcalToken}>
              <ConfirmButton variant="secondary" message="¿Generar un link nuevo? Vas a tener que volver a suscribirte desde tu calendario.">
                Generar link nuevo
              </ConfirmButton>
            </form>
          </div>
        </Card>
      )}

      {tab === "agencia" &&
        (isPlatformAgency(agency) ? (
          <Card>
            <CardHeader title={agency!.name} description={`Trabajás con esta agencia desde ${formatDate(org.agencyJoinedAt)}. Es la que te paga las comisiones.`} />
            <dl className="grid gap-4 p-5 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Contacto</dt>
                <dd className="text-slate-800">{agency!.contactName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Email para comisiones</dt>
                <dd className="text-slate-800">{agency!.contactEmail ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Comisión por defecto</dt>
                <dd className="text-slate-800">{agency!.defaultCommissionRate !== null ? percent(agency!.defaultCommissionRate) : `${percent(org.defaultCommissionRate)} (la tuya)`}</dd>
              </div>
            </dl>
            <div className="border-t border-slate-100 p-5 text-sm text-slate-600">
              <p>
                La agencia ve tus ventas y comisiones: códigos de reserva, destinos, fechas, montos y estado de cobro. <strong>No ve tus clientes</strong> ni puede modificar
                nada de lo que cargás.
              </p>
              <form action={leaveCurrentAgency} className="mt-4">
                <ConfirmButton message={`¿Dejar de trabajar con ${agency!.name}? Va a dejar de ver tus números. Tus datos no cambian.`}>
                  Salir de la agencia
                </ConfirmButton>
              </form>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader title="La agencia que te paga" description="Sus datos se usan en las planillas de comisiones que le mandás para cobrar." />
              <ActionForm action={saveMyAgency} className="grid gap-3 p-5 sm:grid-cols-2">
                <Field label="Nombre">
                  <Input name="name" defaultValue={agency?.name} placeholder="Ej: Agencia Madre Travel" required />
                </Field>
                <Field label="Comisión por defecto (%)" hint={`Vacío = la tuya (${percent(org.defaultCommissionRate)})`}>
                  <Input name="defaultCommissionRate" type="number" step="0.01" min={0} max={100} defaultValue={agency?.defaultCommissionRate?.toString() ?? ""} />
                </Field>
                <Field label="Contacto">
                  <Input name="contactName" defaultValue={agency?.contactName ?? ""} />
                </Field>
                <Field label="Email para comisiones">
                  <Input name="contactEmail" type="email" defaultValue={agency?.contactEmail ?? ""} />
                </Field>
                <Field label="Notas" className="sm:col-span-2">
                  <Input name="notes" defaultValue={agency?.notes ?? ""} placeholder="Ej: liquida a mes vencido, después del viaje" />
                </Field>
                <div>
                  <SubmitButton size="sm">Guardar</SubmitButton>
                </div>
              </ActionForm>
            </Card>
            <Card>
              <CardHeader
                title="¿Tu agencia usa CRM Mágico?"
                description="Ingresá el código que te pasó. Va a poder ver tus ventas y comisiones, pero no tus clientes, y no puede modificar nada."
              />
              <ActionForm action={joinAgencyWithCode} className="flex flex-wrap items-end gap-3 p-5">
                <Field label="Código de la agencia">
                  <Input name="code" className="w-48 uppercase" autoComplete="off" required />
                </Field>
                <SubmitButton variant="secondary">
                  <Building2 className="size-4" /> Unirme
                </SubmitButton>
              </ActionForm>
            </Card>
          </div>
        ))}

      {tab === "cuenta" && (
        <Card>
          <CardHeader title="Mi cuenta" description={user.email} />
          <ActionForm action={updateMyAccount} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nombre">
              <Input name="name" defaultValue={user.name} required />
            </Field>
            <Field label="Teléfono">
              <Input name="phone" defaultValue={user.phone ?? ""} />
            </Field>
            <Field label="Contraseña actual">
              <Input name="currentPassword" type="password" autoComplete="current-password" />
            </Field>
            <Field label="Nueva contraseña" hint="Dejala vacía para no cambiarla">
              <Input name="newPassword" type="password" autoComplete="new-password" />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Guardar</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
