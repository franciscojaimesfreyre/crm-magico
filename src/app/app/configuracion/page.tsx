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
import { TravelerAvatar } from "@/components/traveler-avatar";
import { AVATAR_COLORS, AVATAR_SET, resolveAvatar } from "@/lib/avatars";
import { avatarImages } from "@/lib/avatars-server";
import { addAvatarImage, deleteAvatarImage } from "./avatar-actions";
import { FileUpload } from "@/components/file-upload";
import { storageMode } from "@/lib/storage";

export const metadata = { title: "Configuración" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { tab = "negocio" } = await searchParams;
  const org = user.organization;
  const agency = org.agency;
  const tabs = [
    { key: "negocio", label: "Mi negocio" },
    { key: "agencia", label: "Mi agencia" },
    { key: "personajes", label: "Personajes" },
    { key: "cuenta", label: "Mi cuenta" },
  ];

  return (
    <div className="max-w-4xl">
      <PageHeader title="Configuración" />
      <Tabs active={tab} tabs={tabs.map((t) => ({ ...t, href: `/app/configuracion?tab=${t.key}` }))} />

      {tab === "negocio" && (
        <Card>
          <CardHeader title="Datos del negocio" description="Se muestran en el portal del cliente, el formulario de cotización y los emails." />
          <ActionForm action={updateOrganization} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
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
            <dl className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-3">
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
              <ActionForm action={saveMyAgency} className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
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

      {tab === "personajes" && <AvatarGallery organizationId={user.organizationId} />}

      {tab === "cuenta" && (
        <Card>
          <CardHeader title="Mi cuenta" description={user.email} />
          <ActionForm action={updateMyAccount} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
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

/** Los personajes que se pueden elegir para los viajeros: el set del CRM y las imágenes propias de la agencia. */
async function AvatarGallery({ organizationId }: { organizationId: string }) {
  const images = await avatarImages(organizationId);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Personajes de tu agencia"
          description="Imágenes propias para que elijas como personaje de cada viajero (y ellos desde su portal). Usá imágenes tuyas o con permiso de uso: las de personajes de Disney o Universal tienen derechos de autor."
        />
        {images.length > 0 && (
          <ul className="grid grid-cols-3 gap-4 p-5 sm:grid-cols-5">
            {images.map((img) => (
              <li key={img.id} className="flex flex-col items-center gap-1.5 text-center">
                <TravelerAvatar avatar={resolveAvatar(`img:${img.id}`, images)} name={img.name} size="lg" />
                <span className="text-xs font-medium text-slate-800">{img.name}</span>
                <form action={deleteAvatarImage.bind(null, img.id)}>
                  <ConfirmButton message={`¿Quitar "${img.name}"? Los viajeros que lo tenían vuelven a sus iniciales.`}>Quitar</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addAvatarImage} resetOnSuccess className="grid grid-cols-1 gap-4 border-t border-[var(--rule)] p-5 sm:grid-cols-2">
          <Field label="Imagen" hint="PNG, JPG o WEBP cuadrada, hasta 5 MB">
            <FileUpload direct={storageMode() === "r2"} />
          </Field>
          <Field label="Nombre">
            <Input name="name" placeholder="Ej: Orejas de ratón" maxLength={40} />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="label">Color de fondo (también tiñe el portal del cliente)</legend>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c, i) => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" name="color" value={c} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="block size-8 rounded-full ring-2 ring-transparent ring-offset-2 peer-checked:ring-slate-900 peer-focus-visible:ring-brand-400" style={{ backgroundColor: c }} aria-label={c} />
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <SubmitButton>Agregar personaje</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title="Personajes del CRM" description="Ilustraciones propias, disponibles para todas las agencias." />
        <div className="space-y-5 p-5">
          {AVATAR_SET.map((g) => (
            <section key={g.group}>
              <h3 className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-[var(--ink-soft)] uppercase">{g.group}</h3>
              <ul className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                {g.items.map((it) => (
                  <li key={it.id} className="flex flex-col items-center gap-1 text-center">
                    <TravelerAvatar avatar={resolveAvatar(`set:${it.id}`)} name={it.label} size="md" />
                    <span className="text-[11px] leading-tight text-slate-600">{it.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
