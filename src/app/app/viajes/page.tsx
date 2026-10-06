import Link from "next/link";
import clsx from "clsx";
import { Download, LayoutGrid, List } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Select, StatCard, Table, Td, Th, buttonClass } from "@/components/ui";
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_COLOR,
  BOOKING_STATUS_LABEL,
  DESTINATIONS,
  DESTINATION_LABEL,
} from "@/lib/labels";
import { formatRange, money, toNumber } from "@/lib/format";
import { bookingWhere, type BookingFilters } from "./filters";
import { Kanban } from "./kanban";

export const metadata = { title: "Viajes" };

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<BookingFilters & { vista?: string }>;
}) {
  const user = await requireUser();
  const filters = await searchParams;
  const view = filters.vista === "tablero" ? "tablero" : "lista";
  const where = bookingWhere(user.organizationId, view === "tablero" ? { ...filters, estado: undefined } : filters);

  const bookings = await db.booking.findMany({
    where,
    include: { client: { select: { firstName: true, lastName: true } }, items: { select: { status: true } } },
    orderBy: [{ startDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 1000,
  });

  const active = bookings.filter((b) => b.status !== "CANCELLED");
  const sold = active.filter((b) => !["INQUIRY", "QUOTED"].includes(b.status));
  const revenue = sold.reduce((s, b) => s + toNumber(b.totalPrice), 0);
  const commission = sold.reduce((s, b) => s + toNumber(b.commissionAmount), 0);
  const currency = user.organization.defaultCurrency;
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
  const viewHref = (v: string) => {
    const p = new URLSearchParams(qs);
    p.set("vista", v);
    return `/app/viajes?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Viajes"
        description="Todo tu pipeline, de la consulta al viaje completado."
        actions={
          <>
            <a href={`/app/viajes/export?${qs}`} className={buttonClass("secondary")}>
              <Download className="size-4" /> CSV
            </a>
            <LinkButton href="/app/viajes/nueva">Nuevo viaje</LinkButton>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Viajes" value={active.length} hint={`${bookings.length - active.length} canceladas`} />
        <StatCard label="Consultas y cotizadas" value={active.length - sold.length} />
        <StatCard label="Vendido" value={money(revenue, currency)} hint={`${sold.length} viajes`} />
        <StatCard label="Comisiones" value={money(commission, currency)} tone="good" />
      </div>

      <form className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3 lg:grid-cols-6">
        <input type="hidden" name="vista" value={view} />
        <input name="q" defaultValue={filters.q} placeholder="Cliente, código o confirmación" className="field lg:col-span-2" />
        {view === "lista" && <Select name="estado" defaultValue={filters.estado ?? ""} options={BOOKING_STATUSES} placeholder="Todos los estados" />}
        <Select name="destino" defaultValue={filters.destino ?? ""} options={DESTINATIONS} placeholder="Todos los destinos" />
        <input type="date" name="desde" defaultValue={filters.desde} className="field" title="Viaja desde" />
        <div className="flex gap-2">
          <input type="date" name="hasta" defaultValue={filters.hasta} className="field" title="Viaja hasta" />
          <button className={buttonClass("primary")}>Filtrar</button>
        </div>
      </form>

      <div className="mb-4 flex gap-1">
        <Link href={viewHref("lista")} className={clsx(buttonClass(view === "lista" ? "primary" : "secondary", "sm"))}>
          <List className="size-4" /> Lista
        </Link>
        <Link href={viewHref("tablero")} className={clsx(buttonClass(view === "tablero" ? "primary" : "secondary", "sm"))}>
          <LayoutGrid className="size-4" /> Tablero
        </Link>
      </div>

      {bookings.length === 0 ? (
        <EmptyState title="No hay viajes" description="Creá un viaje o esperá las consultas de tu formulario web." action={<LinkButton href="/app/viajes/nueva">Nuevo viaje</LinkButton>} />
      ) : view === "tablero" ? (
        <Kanban
          currency={currency}
          cards={active.map((b) => ({
            id: b.id,
            code: b.code,
            title: b.title,
            clientName: `${b.client.firstName} ${b.client.lastName}`,
            destination: b.destination,
            status: b.status,
            dates: formatRange(b.startDate, b.endDate),
            total: toNumber(b.totalPrice),
            totalLabel: money(b.totalPrice, b.currency),
          }))}
        />
      ) : (
        <Card>
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Cliente</Th>
                <Th>Destino</Th>
                <Th>Estado</Th>
                <Th>Viaje</Th>
                <Th className="text-right">Pasajeros</Th>
                <Th>Reservas</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Comisión</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/app/viajes/${b.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {b.client.firstName} {b.client.lastName}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {b.code} · {b.title}
                    </p>
                  </Td>
                  <Td className="text-xs">{DESTINATION_LABEL[b.destination]}</Td>
                  <Td>
                    <Badge className={BOOKING_STATUS_COLOR[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                  </Td>
                  <Td className="text-xs whitespace-nowrap">{formatRange(b.startDate, b.endDate)}</Td>
                  <Td className="text-right">{b.adults + b.children}</Td>
                  <Td className="text-xs whitespace-nowrap">
                    {b.items.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <>
                        {b.items.filter((i) => i.status === "CONFIRMED").length}/{b.items.filter((i) => i.status !== "CANCELLED").length} confirmadas
                      </>
                    )}
                  </Td>
                  <Td className="text-right whitespace-nowrap">{money(b.totalPrice, b.currency)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <span className="text-emerald-700">{money(b.commissionAmount, b.currency)}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
