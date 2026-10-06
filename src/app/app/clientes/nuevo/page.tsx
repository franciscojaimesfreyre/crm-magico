import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "../client-form";
import { createClient } from "../actions";

export const metadata = { title: "Nuevo cliente" };

export default async function NewClientPage() {
  const user = await requireUser();
  const referrers = await db.client.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { lastName: "asc" },
  });
  return (
    <div className="max-w-4xl">
      <PageHeader title="Nuevo cliente" back={{ href: "/app/clientes", label: "Clientes" }} />
      <ClientForm action={createClient} referrers={referrers} submitLabel="Crear cliente" />
    </div>
  );
}
