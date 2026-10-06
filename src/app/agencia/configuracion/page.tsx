import { requireAgencyUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { agencyAgents } from "@/lib/agency-panel";
import { regenerateInviteCode, removeAgent, updateAgency, updateAgencyAccount } from "./actions";

export const metadata = { title: "Configuración de la agencia" };

export default async function AgencySettingsPage() {
  const user = await requireAgencyUser();
  const agency = user.agency;
  const agents = await agencyAgents(agency.id);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const inviteLink = `${appUrl}/registro?agencia=${agency.inviteCode}`;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Configuración" />

      <Card>
        <CardHeader title="Invitar agentes" description="Cada agente tiene su propia cuenta y sus datos son suyos. Vos ves sus ventas y comisiones, sin poder editarlas ni ver a sus clientes." />
        <div className="space-y-4 p-5 text-sm">
          <div>
            <p className="text-xs text-slate-500">Código de invitación</p>
            <p className="font-mono text-2xl font-semibold tracking-widest text-brand-700">{agency.inviteCode}</p>
            <p className="mt-1 text-xs text-slate-500">Si el agente ya tiene cuenta, lo carga en Configuración → Mi agencia.</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Link para crear una cuenta ya unida a tu agencia</p>
            <Input readOnly value={inviteLink} className="font-mono text-xs" />
          </div>
          <form action={regenerateInviteCode}>
            <ConfirmButton variant="secondary" message="¿Generar un código nuevo? El actual y el link dejan de servir. Los agentes que ya están no se ven afectados.">
              Generar código nuevo
            </ConfirmButton>
          </form>
        </div>
      </Card>

      <Card>
        <CardHeader title="Agentes" description={`${agents.length} trabajando con tu agencia`} />
        {agents.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">Todavía no se unió ningún agente.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {agents.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium text-slate-900">{a.users[0]?.name ?? a.name}</p>
                  <p className="text-xs text-slate-500">
                    {a.name} · desde {formatDate(a.agencyJoinedAt)}
                  </p>
                </div>
                <form action={removeAgent.bind(null, a.id)}>
                  <ConfirmButton message={`¿Dejar de trabajar con ${a.users[0]?.name ?? a.name}? Vas a dejar de ver sus números. Sus datos no cambian.`}>
                    Quitar
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Datos de la agencia" description="Tus agentes los ven en su cuenta y salen en las planillas de comisiones que te mandan." />
        <ActionForm action={updateAgency} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nombre">
            <Input name="name" defaultValue={agency.name} required />
          </Field>
          <Field label="Comisión por defecto (%)" hint="La que pagás en general. Cada agente puede ajustarla por servicio.">
            <Input name="defaultCommissionRate" type="number" step="0.01" min={0} max={100} defaultValue={agency.defaultCommissionRate?.toString() ?? ""} />
          </Field>
          <Field label="Contacto">
            <Input name="contactName" defaultValue={agency.contactName ?? ""} />
          </Field>
          <Field label="Email para comisiones" hint="A donde los agentes mandan las planillas">
            <Input name="contactEmail" type="email" defaultValue={agency.contactEmail ?? ""} />
          </Field>
          <Field label="Notas para los agentes" className="sm:col-span-2">
            <Input name="notes" defaultValue={agency.notes ?? ""} placeholder="Ej: liquidamos a mes vencido, después del viaje" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Guardar</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title="Mi cuenta" description={user.email} />
        <ActionForm action={updateAgencyAccount} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nombre">
            <Input name="name" defaultValue={user.name} required />
          </Field>
          <div />
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
    </div>
  );
}
