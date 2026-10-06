import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { KnowledgeForm } from "../knowledge-form";
import { updateKnowledge } from "../actions";

export const metadata = { title: "Editar novedad" };

export default async function EditKnowledge({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const item = await db.knowledgeItem.findUnique({ where: { id } });
  const editable = item && (item.organizationId === user.organizationId || (item.organizationId === null && user.isPlatformAdmin));
  if (!item || !editable) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Editar novedad" back={{ href: "/app/novedades", label: "Novedades" }} />
      <KnowledgeForm action={updateKnowledge.bind(null, id)} item={item} canGlobal={user.isPlatformAdmin} />
    </div>
  );
}
