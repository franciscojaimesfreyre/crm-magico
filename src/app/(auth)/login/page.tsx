import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Field, Input } from "@/components/ui";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { login } from "../actions";

export const metadata = { title: "Ingresar" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Ingresar</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Accedé a tu CRM de agente de viajes o al panel de tu agencia.</p>
      <ActionForm action={login} className="space-y-4">
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
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="font-medium text-brand-700 hover:underline">
          Creá una gratis
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        ¿Sos viajero?{" "}
        <Link href="/portal/login" className="font-medium text-brand-700 hover:underline">
          Entrá a tu portal
        </Link>
      </p>
    </>
  );
}
