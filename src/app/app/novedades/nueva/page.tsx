import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { KnowledgeForm } from "../knowledge-form";
import { createKnowledge } from "../actions";

export const metadata = { title: "Nueva novedad" };

export default async function NewKnowledge() {
  const user = await requireUser();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Nueva novedad" back={{ href: "/app/novedades", label: "Novedades" }} />
      <KnowledgeForm action={createKnowledge} canGlobal={user.isPlatformAdmin} />
    </div>
  );
}
