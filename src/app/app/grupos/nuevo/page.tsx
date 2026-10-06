import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { GroupForm } from "../group-form";
import { createGroup } from "../actions";

export const metadata = { title: "Nuevo grupo" };

export default async function NewGroup() {
  const user = await requireUser();
  const clients = await db.client.findMany({ where: { organizationId: user.organizationId }, orderBy: { lastName: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nuevo grupo" back={{ href: "/app/grupos", label: "Grupos" }} />
      <Card className="p-5">
        <GroupForm action={createGroup} clients={clients.map((c) => ({ value: c.id, label: `${c.lastName}, ${c.firstName}` }))} submitLabel="Crear grupo" />
      </Card>
    </div>
  );
}
