import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { FORM_TEMPLATES } from "@/lib/forms";
import { formatDate } from "@/lib/format";
import { createForm } from "./actions";

export const metadata = { title: "Formularios" };

export default async function FormsPage() {
  const user = await requireUser();
  const forms = await db.form.findMany({
    where: { organizationId: user.organizationId },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <PageHeader title="Formularios" description="Fichas de la familia, encuestas post-viaje, referidos… Cada formulario tiene un link público; las respuestas quedan acá." />
      <Card className="mb-6">
        <CardHeader title="Crear desde una plantilla" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {FORM_TEMPLATES.map((t) => (
            <form key={t.key} action={createForm} className="flex flex-col rounded-xl border border-slate-200 p-4">
              <input type="hidden" name="template" value={t.key} />
              <p className="font-medium text-slate-900">{t.title}</p>
              <p className="mb-3 flex-1 text-xs text-slate-500">{t.description || "Empezá de cero."}</p>
              <SubmitButton size="sm" variant="secondary">
                Usar
              </SubmitButton>
            </form>
          ))}
        </div>
      </Card>
      <Card>
        <ul className="divide-y divide-slate-100">
          {forms.map((f) => (
            <li key={f.id}>
              <Link href={`/app/formularios/${f.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">{f.title}</p>
                  <p className="text-xs text-slate-500">Creado {formatDate(f.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!f.active && <Badge>Cerrado</Badge>}
                  <Badge className="bg-brand-50 text-brand-700">{f._count.submissions} respuestas</Badge>
                </div>
              </Link>
            </li>
          ))}
          {forms.length === 0 && <li className="p-5 text-sm text-slate-500">Todavía no creaste formularios.</li>}
        </ul>
      </Card>
    </>
  );
}
