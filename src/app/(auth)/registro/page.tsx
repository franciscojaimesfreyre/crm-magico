import Link from "next/link";
import clsx from "clsx";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Field, Input } from "@/components/ui";
import { findAgencyByCode } from "@/lib/agencies";
import { signup, signupAgency } from "../actions";

export const metadata = { title: "Crear cuenta" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ tipo?: string; agencia?: string }> }) {
  const sp = await searchParams;
  const isAgency = sp.tipo === "agencia";
  // Link de invitación de una agencia: /registro?agencia=CODIGO
  const invitedBy = !isAgency && sp.agencia ? await findAgencyByCode(sp.agencia) : null;

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Creá tu cuenta</h1>
      <div className="mt-4 mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        <Link
          href={sp.agencia ? `/registro?agencia=${encodeURIComponent(sp.agencia)}` : "/registro"}
          className={clsx("rounded-md px-3 py-1.5 text-center", !isAgency ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
        >
          Soy agente
        </Link>
        <Link
          href="/registro?tipo=agencia"
          className={clsx("rounded-md px-3 py-1.5 text-center", isAgency ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
        >
          Soy una agencia
        </Link>
      </div>

      {isAgency ? (
        <>
          <p className="mb-6 text-sm text-slate-500">
            Invitá a tus agentes y seguí sus ventas y comisiones en un panel. Cada agente gestiona sus clientes y reservas en su propia cuenta.
          </p>
          <ActionForm action={signupAgency} className="space-y-4">
            <Field label="Nombre de la agencia">
              <Input name="businessName" placeholder="Ej: Agencia Madre Travel" required />
            </Field>
            <Field label="Tu nombre">
              <Input name="name" autoComplete="name" required />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Contraseña" hint="Mínimo 8 caracteres">
              <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <SubmitButton className="w-full" pendingText="Creando cuenta…">
              Crear cuenta de agencia
            </SubmitButton>
          </ActionForm>
        </>
      ) : (
        <>
          <p className="mb-6 text-sm text-slate-500">
            {invitedBy ? (
              <>
                Te invitó <strong className="text-slate-700">{invitedBy.name}</strong>: va a ver tus ventas y comisiones, pero tus clientes y reservas son solo tuyos.
              </>
            ) : (
              "Gestioná tus clientes, cotizaciones, reservas y comisiones en un solo lugar."
            )}
          </p>
          <ActionForm action={signup} className="space-y-4">
            <Field label="Nombre de tu negocio">
              <Input name="businessName" placeholder="Ej: Viajes Encantados" required />
            </Field>
            <Field label="Tu nombre">
              <Input name="name" autoComplete="name" required />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Contraseña" hint="Mínimo 8 caracteres">
              <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            {invitedBy ? (
              <input type="hidden" name="agencyCode" value={invitedBy.inviteCode ?? ""} />
            ) : (
              <Field label="Código de tu agencia (opcional)" hint="Si tu agencia usa CRM Mágico, te lo pasa ella. Lo podés cargar después.">
                <Input name="agencyCode" className="uppercase" autoComplete="off" />
              </Field>
            )}
            <SubmitButton className="w-full" pendingText="Creando cuenta…">
              Crear cuenta
            </SubmitButton>
          </ActionForm>
        </>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Ingresá
        </Link>
      </p>
    </>
  );
}
