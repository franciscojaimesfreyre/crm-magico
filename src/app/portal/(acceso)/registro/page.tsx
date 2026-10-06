import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Field, Input } from "@/components/ui";
import { registerPortal } from "../../actions";

export const metadata = { title: "Activar mi portal" };

export default async function PortalRegister({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams;
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Activá tu portal</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Usá el código de 6 caracteres que te envió tu agente de viajes.</p>
      <ActionForm action={registerPortal} className="space-y-4">
        <Field label="Código de invitación">
          <Input name="code" defaultValue={codigo} maxLength={6} className="text-center font-mono text-lg tracking-[0.4em] uppercase" required />
        </Field>
        <Field label="Tu email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Elegí una contraseña" hint="Mínimo 8 caracteres">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton className="w-full" pendingText="Activando…">
          Activar
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        ¿Ya tenés cuenta?{" "}
        <Link href="/portal/login" className="font-medium text-brand-700 hover:underline">
          Ingresá
        </Link>
      </p>
    </>
  );
}
