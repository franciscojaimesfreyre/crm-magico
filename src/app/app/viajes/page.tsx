import Link from "next/link";
import clsx from "clsx";
import { Download, LayoutGrid, List } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Select, StatCard, StatStrip, Table, Td, Th, buttonClass } from "@/components/ui";
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_COLOR,
  BOOKING_STATUS_LABEL,
  DESTINATIONS,
  DESTINATION_LABEL, DESTINATION_TONE,
} from "@/lib/labels";
import { daysBetween, formatRange, money, todayUTC, toNumber } from "@/lib/format";
import { bookingWhere, type BookingFilters } from "./filters";
import { Kanban } from "./kanban";
import { DateInput } from "@/components/date-input";

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

      <StatStrip className="mb-6">
        <StatCard label="Viajes" value={active.length} hint={`${bookings.length - active.length} canceladas`} />
        <StatCard label="Consultas y cotizadas" value={active.length - sold.length} />
        <StatCard label="Vendido" value={money(revenue, currency)} hint={`${sold.length} viajes`} />
        <StatCard label="Comisiones" value={money(commission, currency)} tone="good" />
      </StatStrip>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Vista: control segmentado neutro (el color de marca queda para la acción principal). */}
        <div className="inline-flex rounded-md bg-[var(--raised)] p-0.5" role="tablist" aria-label="Vista">
          {(
            [
              ["lista", "Lista", List],
              ["tablero", "Tablero", LayoutGrid],
            ] as const
          ).map(([key, label, Icon]) => (
            <Link
              key={key}
              href={viewHref(key)}
              role="tab"
              aria-selected={view === key}
              className={clsx(
                "inline-flex h-8 items-center gap-1.5 rounded px-3 text-[13px] font-medium",
                view === key ? "bg-white text-slate-900 ring-1 ring-[var(--border)]" : "text-[var(--ink-soft)] hover:text-slate-900",
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </div>
        <p className="text-sm text-[var(--ink-soft)] tabular-nums">
          {bookings.length} {bookings.length === 1 ? "viaje" : "viajes"}
        </p>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input type="hidden" name="vista" value={view} />
        <input name="q" defaultValue={filters.q} placeholder="Cliente, código o confirmación" className="field min-w-60 flex-1" />
        {view === "lista" && <Select name="estado" defaultValue={filters.estado ?? ""} options={BOOKING_STATUSES} placeholder="Todos los estados" className="w-auto" />}
        <Select name="destino" defaultValue={filters.destino ?? ""} options={DESTINATIONS} placeholder="Todos los destinos" className="w-auto" />
        <label className="flex items-center gap-1.5 text-[13px] text-[var(--ink-soft)]">
          Desde <DateInput name="desde" defaultValue={filters.desde} className="w-auto" />
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-[var(--ink-soft)]">
          Hasta <DateInput name="hasta" defaultValue={filters.hasta} className="w-auto" />
        </label>
        <button className={buttonClass("secondary")}>Filtrar</button>
      </form>

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
            daysToGo: b.startDate ? daysBetween(todayUTC(), b.startDate) : null,
          }))}
        />
      ) : (
        <Card>
          <Table>
            <thead>
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
                    <p className="text-xs text-slate-500">
                      {b.code} · {b.title}
                    </p>
                  </Td>
                  <Td className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className={clsx("size-2 shrink-0 rounded-full", DESTINATION_TONE[b.destination].dot)} />
                      {DESTINATION_LABEL[b.destination]}
                    </span>
                  </Td>
                  <Td>
                    <Badge className={BOOKING_STATUS_COLOR[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                  </Td>
                  <Td className="text-xs whitespace-nowrap">{formatRange(b.startDate, b.endDate)}</Td>
                  <Td className="text-right">{b.adults + b.children}</Td>
                  <Td className="text-xs whitespace-nowrap">
                    {b.items.length === 0 ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <>
                        {b.items.filter((i) => i.status === "CONFIRMED").length}/{b.items.filter((i) => i.status !== "CANCELLED").length} confirmadas
                      </>
                    )}
                  </Td>
                  <Td className="text-right whitespace-nowrap">{money(b.totalPrice, b.currency)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <span className="text-slate-700">{money(b.commissionAmount, b.currency)}</span>
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
