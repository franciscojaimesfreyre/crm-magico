import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "../client-form";
import { createClient } from "../actions";

export const metadata = { title: "Nuevo cliente" };

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ para?: string }> }) {
  const { para } = await searchParams;
  const fromTrip = para === "viaje";
  const user = await requireUser();
  const referrers = await db.client.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { lastName: "asc" },
  });
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Nuevo cliente"
        description={fromTrip ? "Cuando lo guardes vas a poder crear su viaje." : undefined}
        back={fromTrip ? { href: "/app/viajes/nueva", label: "Nuevo viaje" } : { href: "/app/clientes", label: "Clientes" }}
      />
      <ClientForm
        action={createClient}
        referrers={referrers}
        submitLabel={fromTrip ? "Crear cliente y seguir con el viaje" : "Crear cliente"}
        hiddenFields={fromTrip ? { para: "viaje" } : undefined}
      />
    </div>
  );
}
