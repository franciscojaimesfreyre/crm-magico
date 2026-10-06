import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Field, Input } from "@/components/ui";
import { getCurrentClientAccount } from "@/lib/auth";
import { loginPortal } from "../../actions";

export const metadata = { title: "Ingresar al portal" };

export default async function PortalLogin() {
  if (await getCurrentClientAccount()) redirect("/portal");
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">¡Hola de nuevo!</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Entrá para ver tus viajes, tu itinerario y hablar con tu agente.</p>
      <ActionForm action={loginPortal} className="space-y-4">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Contraseña">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Ingresando…">
          Ingresar
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        ¿Es tu primera vez?{" "}
        <Link href="/portal/registro" className="font-medium text-brand-700 hover:underline">
          Activá tu cuenta con tu código
        </Link>
      </p>
    </>
  );
}
