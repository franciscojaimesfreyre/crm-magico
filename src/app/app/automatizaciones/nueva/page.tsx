import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { WorkflowForm } from "../workflow-form";
import { saveWorkflow } from "../actions";

export const metadata = { title: "Nueva automatización" };

export default async function NewWorkflow() {
  const user = await requireUser();
  const templates = await db.emailTemplate.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-4xl">
      <PageHeader title="Nueva automatización" back={{ href: "/app/automatizaciones", label: "Automatizaciones" }} />
      <WorkflowForm action={saveWorkflow.bind(null, null)} templates={templates.map((t) => ({ value: t.id, label: t.name }))} />
    </div>
  );
}
