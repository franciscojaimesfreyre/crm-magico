import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, Input, PageHeader } from "@/components/ui";
import { FORM_TEMPLATES, isPersonalForm, type FormField } from "@/lib/forms";
import { formatDate } from "@/lib/format";
import { createForm } from "./actions";

export const metadata = { title: "Formularios" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function FormsPage() {
  const user = await requireUser();
  const forms = await db.form.findMany({
    where: { organizationId: user.organizationId },
    include: {
      _count: { select: { submissions: true, requests: { where: { status: { not: "ANSWERED" } } } } },
      submissions: { where: { appliedAt: null }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const groups = [
    { title: "Para pedirle a un cliente", description: "Se envían desde la ficha del cliente o desde el viaje, con un link personal: la respuesta llega asociada.", list: FORM_TEMPLATES.filter((t) => t.personal) },
    { title: "Para compartir con cualquiera", description: "Un link público para redes o WhatsApp: después asociás cada respuesta a un cliente.", list: FORM_TEMPLATES.filter((t) => !t.personal) },
  ];
  return (
    <>
      <PageHeader title="Formularios" description="Datos de los viajeros, cuestionario previo, encuesta post-viaje, referidos… Las respuestas se revisan acá y pasan a la ficha del cliente." />
      <Card className="mb-6">
        <ul className="divide-y divide-slate-100">
          {forms.map((f) => (
            <li key={f.id}>
              <Link href={`/app/formularios/${f.id}${f.submissions.length ? "?tab=respuestas" : ""}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">{f.title}</p>
                  <p className="text-xs text-slate-500">Creado el {formatDate(f.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!f.active && <Badge>Cerrado</Badge>}
                  {isPersonalForm(f.fields as FormField[]) ? <Badge className="bg-violet-50 text-violet-800">Personal</Badge> : <Badge className="bg-slate-100 text-slate-700">Link público</Badge>}
                  {f._count.requests > 0 && <Badge className="bg-slate-100 text-slate-700">{plural(f._count.requests, "esperando respuesta", "esperando respuesta")}</Badge>}
                  {f.submissions.length > 0 && <Badge className="bg-amber-100 text-amber-900">{plural(f.submissions.length, "sin revisar", "sin revisar")}</Badge>}
                  <Badge className="bg-brand-50 text-brand-700">{plural(f._count.submissions, "respuesta", "respuestas")}</Badge>
                </div>
              </Link>
            </li>
          ))}
          {forms.length === 0 && <li className="p-5 text-sm text-slate-500">Todavía no creaste formularios. Empezá con una plantilla.</li>}
        </ul>
      </Card>
      {groups.map((g) => (
        <Card key={g.title} className="mb-6">
          <CardHeader title={g.title} description={g.description} />
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.list.map((t) => (
              <form key={t.key} action={createForm} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4">
                <input type="hidden" name="template" value={t.key} />
                <p className="font-medium text-slate-900">{t.title}</p>
                <p className="flex-1 text-xs text-slate-500">{t.description || "Empezá de cero."}</p>
                <label>
                  <span className="label">Nombre</span>
                  <Input name="title" defaultValue={t.title} required />
                </label>
                <SubmitButton size="sm" variant="secondary">
                  Crear formulario
                </SubmitButton>
              </form>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}
