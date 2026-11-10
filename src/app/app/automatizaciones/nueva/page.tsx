import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { WorkflowForm } from "../workflow-form";
import { saveWorkflow } from "../actions";

export const metadata = { title: "Nueva automatización" };

export default async function NewWorkflow() {
  const user = await requireUser();
  const [templates, forms] = await Promise.all([
    db.emailTemplate.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    db.form.findMany({ where: { organizationId: user.organizationId, active: true }, orderBy: { title: "asc" } }),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Nueva automatización" back={{ href: "/app/automatizaciones", label: "Automatizaciones" }} />
      <WorkflowForm action={saveWorkflow.bind(null, null)} templates={templates.map((t) => ({ value: t.id, label: t.name }))} forms={forms.map((f) => ({ value: f.id, label: f.title }))} />
    </div>
  );
}
