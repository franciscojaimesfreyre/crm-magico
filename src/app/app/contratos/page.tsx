import Link from "next/link";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton, type ActionState } from "@/components/form-controls";
import { Badge, Card, CardHeader, EmptyState, Field, Input, LinkButton, PageHeader, Table, Tabs, Td, Textarea, Th } from "@/components/ui";
import { CONTRACT_STATUS_COLOR, CONTRACT_STATUS_LABEL } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { TEMPLATE_VARIABLES } from "@/lib/templating";
import type { ContractTemplate } from "@/generated/prisma/client";
import { deleteContractTemplate, saveContractTemplate } from "./actions";

export const metadata = { title: "Contratos" };

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { tab = "enviados" } = await searchParams;
  const [contracts, templates] = await Promise.all([
    db.contract.findMany({ where: { organizationId: user.organizationId }, include: { client: true, booking: true }, orderBy: { createdAt: "desc" } }),
    db.contractTemplate.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
  ]);
  const pending = contracts.filter((c) => c.status === "SENT" || c.status === "VIEWED").length;
  return (
    <>
      <PageHeader
        title="Contratos"
        description="Generá contratos desde plantillas y que el cliente los firme online desde cualquier dispositivo."
        actions={<LinkButton href="/app/contratos/nuevo">Nuevo contrato</LinkButton>}
      />
      <Tabs
        active={tab}
        tabs={[
          { key: "enviados", label: pending ? `Contratos (${pending} sin firmar)` : "Contratos", href: "/app/contratos?tab=enviados" },
          { key: "plantillas", label: "Plantillas", href: "/app/contratos?tab=plantillas", count: templates.length },
        ]}
      />
      {tab === "enviados" &&
        (contracts.length === 0 ? (
          <EmptyState title="No hay contratos" action={<LinkButton href="/app/contratos/nuevo">Crear el primero</LinkButton>} />
        ) : (
          <Card>
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Cliente</Th>
                  <Th>Contrato</Th>
                  <Th>Estado</Th>
                  <Th>Enviado</Th>
                  <Th>Firmado</Th>
                  <Th>Vence</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/app/contratos/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {c.client.firstName} {c.client.lastName}
                      </Link>
                      {c.booking && <p className="text-xs text-slate-400">{c.booking.code}</p>}
                    </Td>
                    <Td>{c.title}</Td>
                    <Td>
                      <Badge className={CONTRACT_STATUS_COLOR[c.status]}>{CONTRACT_STATUS_LABEL[c.status]}</Badge>
                    </Td>
                    <Td className="text-xs">{formatDateTime(c.sentAt)}</Td>
                    <Td className="text-xs">{formatDateTime(c.signedAt)}</Td>
                    <Td className="text-xs">{formatDate(c.expiresAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}
      {tab === "plantillas" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            {templates.map((t) => (
              <Card key={t.id}>
                <details>
                  <summary className="cursor-pointer list-none px-5 py-4 font-medium text-slate-900">{t.name}</summary>
                  <div className="border-t border-slate-100 p-5">
                    <TemplateForm action={saveContractTemplate.bind(null, t.id)} template={t} />
                    <form action={deleteContractTemplate.bind(null, t.id)} className="mt-3">
                      <ConfirmButton message="¿Eliminar la plantilla?">
                        <Trash2 className="size-3.5" /> Eliminar
                      </ConfirmButton>
                    </form>
                  </div>
                </details>
              </Card>
            ))}
            <Card>
              <CardHeader title="Nueva plantilla" />
              <div className="p-5">
                <TemplateForm action={saveContractTemplate.bind(null, null)} />
              </div>
            </Card>
          </div>
          <Card className="self-start p-4">
            <p className="mb-2 text-sm font-semibold">Variables</p>
            <ul className="space-y-1 text-xs">
              {TEMPLATE_VARIABLES.map((v) => (
                <li key={v.key}>
                  <code className="text-brand-700">{`{{${v.key}}}`}</code> <span className="text-slate-500">{v.label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}

function TemplateForm({ action, template }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; template?: ContractTemplate }) {
  return (
    <ActionForm action={action} resetOnSuccess={!template} className="space-y-3">
      <Field label="Nombre">
        <Input name="name" defaultValue={template?.name} required />
      </Field>
      <Field label="Texto del contrato">
        <Textarea name="body" rows={16} defaultValue={template?.body} className="font-mono text-xs" required />
      </Field>
      <SubmitButton size="sm">Guardar</SubmitButton>
    </ActionForm>
  );
}
