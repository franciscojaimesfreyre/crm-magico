import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { BookingForm } from "../booking-form";
import { createBooking } from "../actions";
import { bookingFormOptions } from "../form-options";

export const metadata = { title: "Nuevo viaje" };

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const { clientId } = await searchParams;
  const user = await requireUser();
  const [clients, options] = await Promise.all([
    db.client.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    bookingFormOptions(user.organizationId),
  ]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="Nuevo viaje" back={{ href: "/app/viajes", label: "Viajes" }} />
      {clients.length === 0 ? (
        <EmptyState
          title="Primero cargá un cliente"
          action={<LinkButton href="/app/clientes/nuevo">Nuevo cliente</LinkButton>}
        />
      ) : (
        <BookingForm
          action={createBooking}
          clients={clients.map((c) => ({ value: c.id, label: `${c.lastName}, ${c.firstName}` }))}
          defaultClientId={clientId}
          {...options}
          defaultCurrency={user.organization.defaultCurrency}
          submitLabel="Crear viaje"
        />
      )}
    </div>
  );
}
