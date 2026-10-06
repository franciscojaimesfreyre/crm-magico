import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BookingForm } from "../../booking-form";
import { updateBooking } from "../../actions";
import { bookingFormOptions } from "../../form-options";

export const metadata = { title: "Editar viaje" };

export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const booking = await db.booking.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { _count: { select: { items: true } } },
  });
  if (!booking) notFound();
  const options = await bookingFormOptions(user.organizationId);
  return (
    <div className="max-w-5xl">
      <PageHeader title={`Editar ${booking.code}`} back={{ href: `/app/viajes/${id}`, label: booking.title }} />
      <BookingForm
        action={updateBooking.bind(null, id)}
        booking={booking}
        {...options}
        defaultCurrency={user.organization.defaultCurrency}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
