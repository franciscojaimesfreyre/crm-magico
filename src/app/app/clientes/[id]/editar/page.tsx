import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "../../client-form";
import { updateClient } from "../../actions";

export const metadata = { title: "Editar cliente" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const client = await db.client.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!client) notFound();
  const referrers = await db.client.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { lastName: "asc" },
  });
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`Editar a ${client.firstName} ${client.lastName}`}
        back={{ href: `/app/clientes/${id}`, label: "Volver a la ficha" }}
      />
      <ClientForm
        action={updateClient.bind(null, id)}
        client={client}
        referrers={referrers}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
