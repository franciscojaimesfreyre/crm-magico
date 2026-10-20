import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ItineraryEditor } from "@/components/itinerary-editor";
import { parseGuide } from "@/lib/place-guide";
import { parseSheet } from "@/lib/park-sheet";
import { guideOptions, tripEvents } from "@/lib/park-guides";
import { DESTINATION_LABEL } from "@/lib/labels";
import { formatRange, toDateInput } from "@/lib/format";
import { catalogChecks, catalogDestinations, checkTravelers } from "@/lib/catalog";

export const metadata = { title: "Itinerario" };

export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const booking = await db.booking.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      client: true,
      items: { select: { type: true, status: true, description: true, supplier: true, startDate: true } },
      travelers: { include: { traveler: true } },
      days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { position: "asc" } } } },
    },
  });
  if (!booking) notFound();
  const templates = await db.activityTemplate.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ type: "asc" }, { title: "asc" }],
  });

  const destinations = catalogDestinations(booking);
  const [catalog, parkGuides] = await Promise.all([catalogChecks(destinations, user.organizationId), guideOptions(destinations)]);

  return (
    <>
      <PageHeader
        back={{ href: `/app/viajes/${id}?tab=itinerario`, label: booking.title }}
        title="Itinerario"
        description={`${booking.client.firstName} ${booking.client.lastName} · ${DESTINATION_LABEL[booking.destination]} · ${formatRange(booking.startDate, booking.endDate)}`}
      />
      <ItineraryEditor
        target={{ kind: "booking", id }}
        startDate={booking.startDate ? toDateInput(booking.startDate) : null}
        endDate={booking.endDate ? toDateInput(booking.endDate) : null}
        templates={templates}
        // La IA usa credenciales del entorno o del perfil de `ant auth login`.
        aiEnabled
        catalog={catalog}
        parkGuides={parkGuides}
        events={tripEvents(booking.items, parkGuides)}
        travelers={checkTravelers(booking.travelers, booking.startDate)}
        initialDays={booking.days.map((d) => ({
          date: d.date ? toDateInput(d.date) : null,
          title: d.title,
          notes: d.notes,
          items: d.items.map((i) => ({
            type: i.type,
            title: i.title,
            startTime: i.startTime,
            endTime: i.endTime,
            location: i.location,
            notes: i.notes,
            confirmationNumber: i.confirmationNumber,
            guide: parseGuide(i.guide),
            sheet: parseSheet(i.guide),
          })),
        }))}
      />
    </>
  );
}
