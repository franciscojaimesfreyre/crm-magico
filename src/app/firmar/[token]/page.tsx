import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Field, Input } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { signContract } from "./actions";
import { SignaturePad } from "./signature-pad";

export const metadata = { title: "Firmar contrato", robots: { index: false } };

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contract = await db.contract.findUnique({ where: { token }, include: { organization: true, client: true } });
  if (!contract) notFound();
  // Primera apertura: queda registrado que el cliente lo vio.
  if (contract.status === "SENT") {
    await db.contract.update({ where: { id: contract.id }, data: { status: "VIEWED", viewedAt: new Date() } });
  }
  const signed = contract.status === "SIGNED";
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="mb-2 text-center text-sm text-slate-500">{contract.organization.name}</p>
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-xl font-semibold text-slate-900">{contract.title}</h1>
          <article className="text-sm leading-relaxed whitespace-pre-line text-slate-800">{contract.body}</article>
        </div>
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          {signed ? (
            <div className="flex items-start gap-3 text-emerald-800">
              <CheckCircle2 className="size-6 shrink-0" />
              <div>
                <p className="font-semibold">Contrato firmado</p>
                <p className="text-sm">
                  Firmado por {contract.signerName} el {formatDateTime(contract.signedAt)}.
                </p>
              </div>
            </div>
          ) : (
            <ActionForm action={signContract.bind(null, token)} className="space-y-4">
              <Field label="Tu nombre completo">
                <Input name="signerName" defaultValue={`${contract.client.firstName} ${contract.client.lastName}`} required />
              </Field>
              <SignaturePad />
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" name="accept" className="mt-0.5 size-4 rounded border-slate-300" required />
                Leí el contrato y acepto firmarlo electrónicamente.
              </label>
              <SubmitButton className="w-full py-3" pendingText="Firmando…">
                Firmar contrato
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>
    </div>
  );
}
