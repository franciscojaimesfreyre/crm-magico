import Link from "next/link";
import { notFound } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { CopyText } from "@/app/app/clientes/[id]/client-widgets";
import { PrintButton } from "@/app/app/comisiones/widgets";
import { CONTRACT_STATUS_COLOR, CONTRACT_STATUS_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { deleteContract, sendContract, updateContractBody } from "../actions";

export const metadata = { title: "Contrato" };

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const c = await db.contract.findFirst({ where: { id, organizationId: user.organizationId }, include: { client: true, booking: true } });
  if (!c) notFound();
  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/firmar/${c.token}`;
  const signed = c.status === "SIGNED";
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          back={{ href: "/app/contratos", label: "Contratos" }}
          title={
            <span className="flex items-center gap-2">
              {c.title} <Badge className={CONTRACT_STATUS_COLOR[c.status]}>{CONTRACT_STATUS_LABEL[c.status]}</Badge>
            </span>
          }
          description={
            <>
              <Link href={`/app/clientes/${c.clientId}`} className="text-brand-700 hover:underline">
                {c.client.firstName} {c.client.lastName}
              </Link>
              {c.booking && (
                <>
                  {" · "}
                  <Link href={`/app/viajes/${c.booking.id}`} className="text-brand-700 hover:underline">
                    {c.booking.code}
                  </Link>
                </>
              )}
            </>
          }
          actions={<PrintButton />}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6 print:border-0 print:shadow-none">
          {signed ? (
            <>
              <article className="text-sm leading-relaxed whitespace-pre-line text-slate-800">{c.body}</article>
              <div className="mt-8 border-t border-slate-200 pt-4">
                {c.signatureImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.signatureImage} alt="Firma" className="h-24" />
                )}
                <p className="text-sm font-medium">{c.signerName}</p>
                <p className="text-xs text-slate-500">
                  Firmado electrónicamente el {formatDateTime(c.signedAt)}
                  {c.signerIp && ` · IP ${c.signerIp}`}
                </p>
              </div>
            </>
          ) : (
            <ActionForm action={updateContractBody.bind(null, c.id)} className="space-y-3">
              <Field label="Título">
                <Input name="title" defaultValue={c.title} />
              </Field>
              <Field label="Texto (podés ajustarlo antes de enviarlo)">
                <Textarea name="body" rows={24} defaultValue={c.body} className="text-sm leading-relaxed" />
              </Field>
              <SubmitButton variant="secondary" size="sm">
                Guardar cambios
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
        <aside className="space-y-4 print:hidden">
          <Card>
            <CardHeader title="Firma online" />
            <div className="space-y-3 p-4 text-sm">
              {!signed && (
                <ActionForm action={sendContract.bind(null, c.id)}>
                  <SubmitButton pendingText="Enviando…">
                    <Send className="size-4" /> {c.sentAt ? "Reenviar" : "Enviar para firmar"}
                  </SubmitButton>
                </ActionForm>
              )}
              <div>
                <p className="text-xs text-slate-500">Link de firma</p>
                <code className="block truncate text-xs">{link}</code>
                <CopyText text={link} label="Copiar link" />
              </div>
              <dl className="space-y-1 text-xs text-slate-600">
                <div>Enviado: {formatDateTime(c.sentAt)}</div>
                <div>Visto: {formatDateTime(c.viewedAt)}</div>
                <div>Firmado: {formatDateTime(c.signedAt)}</div>
              </dl>
            </div>
          </Card>
          {!signed && (
            <form action={deleteContract.bind(null, c.id)}>
              <ConfirmButton message="¿Eliminar el contrato?">
                <Trash2 className="size-3.5" /> Eliminar
              </ConfirmButton>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
