import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trash2, Unlink } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, LinkButton, PageHeader, Select, StatCard, Table, Td, Th, Textarea } from "@/components/ui";
import { ItineraryView } from "@/components/itinerary-view";
import { BOOKING_STATUS_COLOR, BOOKING_STATUS_LABEL, DESTINATION_LABEL, GROUP_STATUS_LABEL } from "@/lib/labels";
import { formatRange, money, toNumber } from "@/lib/format";
import { GroupForm } from "../group-form";
import { broadcastToGroup, deleteGroup, linkBooking, unlinkBooking, updateGroup } from "../actions";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const group = await db.group.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      organizer: true,
      bookings: { include: { client: true, items: true }, orderBy: { createdAt: "asc" } },
      days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { position: "asc" } } } },
    },
  });
  if (!group) notFound();
  const [available, clients] = await Promise.all([
    db.booking.findMany({
      where: { organizationId: user.organizationId, groupId: null, status: { notIn: ["CANCELLED", "COMPLETED"] } },
      include: { client: true },
      orderBy: { createdAt: "desc" },
    }),
    db.client.findMany({ where: { organizationId: user.organizationId }, orderBy: { lastName: "asc" } }),
  ]);
  const active = group.bookings.filter((b) => b.status !== "CANCELLED");
  const currency = active[0]?.currency ?? user.organization.defaultCurrency;
  const guests = active.reduce((s, b) => s + b.adults + b.children, 0);
  const revenue = active.reduce((s, b) => s + toNumber(b.totalPrice), 0);
  const deposits = active.reduce(
    (s, b) => s + b.items.filter((i) => i.status !== "CANCELLED").reduce((t, i) => t + toNumber(i.paidAmount), 0),
    0,
  );

  return (
    <>
      <PageHeader
        back={{ href: "/app/grupos", label: "Grupos" }}
        title={
          <span className="flex items-center gap-2">
            {group.name} <Badge className="bg-brand-50 text-brand-700">{GROUP_STATUS_LABEL[group.status]}</Badge>
          </span>
        }
        description={`${group.destination ? DESTINATION_LABEL[group.destination] + " · " : ""}${formatRange(group.startDate, group.endDate)}${group.organizer ? ` · Organiza ${group.organizer.firstName} ${group.organizer.lastName}` : ""}`}
        actions={
          <LinkButton href={`/app/grupos/${id}/itinerario`}>
            <Pencil className="size-4" /> Itinerario del grupo
          </LinkButton>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="Viajes" value={active.length} />
        <StatCard label="Viajeros" value={guests} />
        <StatCard label="Total vendido" value={money(revenue, currency)} />
        <StatCard label="Pagado por los clientes" value={money(deposits, currency)} tone="good" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Viajes del grupo" description="Cada familia tiene su viaje, con sus reservas, pagos y documentos." />
            {group.bookings.length > 0 && (
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Cliente</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Viajeros</Th>
                    <Th className="text-right">Total</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.bookings.map((b) => (
                    <tr key={b.id}>
                      <Td>
                        <Link href={`/app/viajes/${b.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                          {b.client.firstName} {b.client.lastName}
                        </Link>
                        <p className="text-xs text-slate-400">{b.code}</p>
                      </Td>
                      <Td>
                        <Badge className={BOOKING_STATUS_COLOR[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                      </Td>
                      <Td className="text-right">{b.adults + b.children}</Td>
                      <Td className="text-right">{money(b.totalPrice, b.currency)}</Td>
                      <Td>
                        <form action={unlinkBooking.bind(null, id, b.id)}>
                          <button className="text-slate-400 hover:text-rose-600" title="Desvincular del grupo">
                            <Unlink className="size-4" />
                          </button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <form action={linkBooking.bind(null, id)} className="flex gap-2 border-t border-slate-100 p-4">
              <Select
                name="bookingId"
                options={available.map((b) => ({ value: b.id, label: `${b.client.lastName}, ${b.client.firstName} — ${b.code} ${b.title}` }))}
                placeholder="Vincular un viaje existente…"
                required
              />
              <SubmitButton variant="secondary">Vincular</SubmitButton>
              <LinkButton variant="ghost" href={`/app/viajes/nueva`}>
                Nueva
              </LinkButton>
            </form>
          </Card>

          <Card>
            <CardHeader title="Itinerario compartido" description="Lo ven todas las familias del grupo (si su viaje no tiene un itinerario propio)." />
            <div className="p-4">
              {group.days.length ? <ItineraryView days={group.days} compact /> : <p className="text-sm text-slate-500">Todavía no hay itinerario.</p>}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Mensaje a todo el grupo" description="Llega al chat de cada viaje y al portal." />
            <ActionForm action={broadcastToGroup.bind(null, id)} resetOnSuccess className="space-y-3 p-4">
              <Textarea name="body" rows={4} placeholder="Ej: ¡Ya está el itinerario del grupo! Nos encontramos el día 2 a las 8:30 en la entrada de Magic Kingdom." />
              <SubmitButton pendingText="Enviando…">Enviar a todos</SubmitButton>
            </ActionForm>
          </Card>
          <Card>
            <CardHeader title="Datos del grupo" />
            <div className="p-4">
              <GroupForm action={updateGroup.bind(null, id)} group={group} clients={clients.map((c) => ({ value: c.id, label: `${c.lastName}, ${c.firstName}` }))} submitLabel="Guardar" />
            </div>
          </Card>
          <form action={deleteGroup.bind(null, id)}>
            <ConfirmButton message="¿Eliminar el grupo? Los viajes no se borran, solo se desvinculan.">
              <Trash2 className="size-3.5" /> Eliminar grupo
            </ConfirmButton>
          </form>
        </aside>
      </div>
    </>
  );
}
