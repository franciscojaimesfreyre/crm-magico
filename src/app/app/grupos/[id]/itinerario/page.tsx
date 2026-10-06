import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ItineraryEditor } from "@/components/itinerary-editor";
import { formatRange, toDateInput } from "@/lib/format";

export const metadata = { title: "Itinerario del grupo" };

export default async function GroupItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const group = await db.group.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { position: "asc" } } } } },
  });
  if (!group) notFound();
  const templates = await db.activityTemplate.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ type: "asc" }, { title: "asc" }] });
  return (
    <>
      <PageHeader back={{ href: `/app/grupos/${id}`, label: group.name }} title="Itinerario del grupo" description={formatRange(group.startDate, group.endDate)} />
      <ItineraryEditor
        target={{ kind: "group", id }}
        startDate={group.startDate ? toDateInput(group.startDate) : null}
        endDate={group.endDate ? toDateInput(group.endDate) : null}
        templates={templates}
        // La propuesta de la IA se basa en el perfil de una familia: se usa desde cada reserva.
        aiEnabled={false}
        initialDays={group.days.map((d) => ({
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
          })),
        }))}
      />
    </>
  );
}
