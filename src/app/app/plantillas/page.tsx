import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton, type ActionState } from "@/components/form-controls";
import { Badge, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_LABEL } from "@/lib/labels";
import { TEMPLATE_VARIABLES } from "@/lib/templating";
import type { EmailTemplate } from "@/generated/prisma/client";
import { deleteEmailTemplate, saveEmailTemplate } from "./actions";

export const metadata = { title: "Plantillas de email" };

export default async function TemplatesPage() {
  const user = await requireUser();
  const [templates, emails] = await Promise.all([
    db.emailTemplate.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.emailLog.findMany({ where: { organizationId: user.organizationId }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  return (
    <>
      <PageHeader title="Plantillas de email" description="Se usan para enviar emails a clientes y en las automatizaciones. Las variables se completan solas." />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-medium text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.subject}</p>
                  </div>
                  <Badge>{TEMPLATE_CATEGORY_LABEL[t.category]}</Badge>
                </summary>
                <div className="border-t border-slate-100 p-5">
                  <TemplateForm action={saveEmailTemplate.bind(null, t.id)} template={t} />
                  <form action={deleteEmailTemplate.bind(null, t.id)} className="mt-3">
                    <ConfirmButton message="¿Eliminar la plantilla? Las automatizaciones que la usan van a fallar.">
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
              <TemplateForm action={saveEmailTemplate.bind(null, null)} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Últimos emails" description="Si no configuraste SMTP, los emails quedan registrados acá como “registrado” pero no salen." />
            <ul className="divide-y divide-slate-100 text-sm">
              {emails.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-slate-800">{e.subject}</p>
                    <p className="text-xs text-slate-500">{e.to}</p>
                  </div>
                  <Badge className={e.status === "SENT" ? "bg-emerald-100 text-emerald-800" : e.status === "FAILED" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"}>
                    {e.status === "SENT" ? "Enviado" : e.status === "FAILED" ? "Falló" : "Registrado"}
                  </Badge>
                </li>
              ))}
              {emails.length === 0 && <li className="px-5 py-3 text-slate-500">Todavía no se enviaron emails.</li>}
            </ul>
          </Card>
        </div>
        <Card className="self-start p-4">
          <p className="mb-2 text-sm font-semibold text-slate-900">Variables disponibles</p>
          <ul className="space-y-1 text-xs">
            {TEMPLATE_VARIABLES.map((v) => (
              <li key={v.key}>
                <code className="text-brand-700">{`{{${v.key}}}`}</code> <span className="text-slate-500">{v.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function TemplateForm({ action, template }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; template?: EmailTemplate }) {
  return (
    <ActionForm action={action} resetOnSuccess={!template} className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre">
        <Input name="name" defaultValue={template?.name} required />
      </Field>
      <Field label="Categoría">
        <Select name="category" options={TEMPLATE_CATEGORIES} defaultValue={template?.category ?? "CUSTOM"} />
      </Field>
      <Field label="Asunto" className="sm:col-span-2">
        <Input name="subject" defaultValue={template?.subject} required />
      </Field>
      <Field label="Mensaje" className="sm:col-span-2">
        <Textarea name="body" rows={9} defaultValue={template?.body} className="font-mono text-xs" required />
      </Field>
      <div>
        <SubmitButton size="sm">Guardar</SubmitButton>
      </div>
    </ActionForm>
  );
}
