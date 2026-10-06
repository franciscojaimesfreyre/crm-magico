import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ConfirmButton } from "@/components/form-controls";
import { PageHeader } from "@/components/ui";
import { WorkflowForm } from "../workflow-form";
import { deleteWorkflow, saveWorkflow } from "../actions";

export const metadata = { title: "Editar automatización" };

export default async function EditWorkflow({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [workflow, templates] = await Promise.all([
    db.workflow.findFirst({ where: { id, organizationId: user.organizationId } }),
    db.emailTemplate.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
  ]);
  if (!workflow) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={workflow.name}
        back={{ href: "/app/automatizaciones", label: "Automatizaciones" }}
        actions={
          <form action={deleteWorkflow.bind(null, id)}>
            <ConfirmButton message="¿Eliminar esta automatización?">
              <Trash2 className="size-3.5" /> Eliminar
            </ConfirmButton>
          </form>
        }
      />
      <WorkflowForm action={saveWorkflow.bind(null, id)} workflow={workflow} templates={templates.map((t) => ({ value: t.id, label: t.name }))} />
    </div>
  );
}
