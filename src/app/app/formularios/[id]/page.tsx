import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Card, CardHeader, PageHeader, Tabs } from "@/components/ui";
import { CopyText } from "@/app/app/clientes/[id]/client-widgets";
import { formatDateTime } from "@/lib/format";
import type { FormField } from "@/lib/forms";
import { FormEditor } from "../form-editor";
import { convertSubmission, deleteForm } from "../actions";
import { appUrl } from "@/lib/app-url";

export default async function FormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "editar" } = await searchParams;
  const user = await requireUser();
  const form = await db.form.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { submissions: { orderBy: { createdAt: "desc" }, take: 200 } },
  });
  if (!form) notFound();
  const fields = form.fields as FormField[];
  const url = `${appUrl()}/f/${form.slug}`;
  return (
    <>
      <PageHeader
        back={{ href: "/app/formularios", label: "Formularios" }}
        title={form.title}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <code className="text-xs">{url}</code>
            <CopyText text={url} label="Copiar link" />
            <a href={url} target="_blank" className="text-xs text-brand-700 hover:underline">
              Abrir <ExternalLink className="inline size-3" />
            </a>
          </span>
        }
        actions={
          <form action={deleteForm.bind(null, id)}>
            <ConfirmButton message="¿Eliminar el formulario y sus respuestas?">
              <Trash2 className="size-3.5" /> Eliminar
            </ConfirmButton>
          </form>
        }
      />
      <Tabs
        active={tab}
        tabs={[
          { key: "editar", label: "Editar", href: `/app/formularios/${id}` },
          { key: "respuestas", label: "Respuestas", href: `/app/formularios/${id}?tab=respuestas`, count: form.submissions.length },
        ]}
      />
      {tab === "editar" ? (
        <FormEditor id={id} initial={{ title: form.title, description: form.description ?? "", active: form.active, fields }} />
      ) : (
        <div className="space-y-4">
          {form.submissions.length === 0 && <p className="text-sm text-slate-500">Todavía no hay respuestas.</p>}
          {form.submissions.map((s) => {
            const data = (s.data ?? {}) as Record<string, string | boolean>;
            return (
              <Card key={s.id}>
                <CardHeader
                  title={formatDateTime(s.createdAt)}
                  actions={
                    s.clientId ? (
                      <Link href={`/app/clientes/${s.clientId}`} className="text-xs text-brand-700 hover:underline">
                        Ver cliente
                      </Link>
                    ) : (
                      <form action={convertSubmission.bind(null, s.id)}>
                        <SubmitButton size="sm" variant="secondary">
                          <UserPlus className="size-3.5" /> Pasar a cliente
                        </SubmitButton>
                      </form>
                    )
                  }
                />
                <dl className="grid gap-3 p-5 text-sm sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.id}>
                      <dt className="text-xs text-slate-400">{f.label}</dt>
                      <dd className="whitespace-pre-line text-slate-800">{data[f.id] === true ? "Sí" : data[f.id] === false ? "No" : String(data[f.id] ?? "—") || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
