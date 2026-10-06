import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, CardHeader, PageHeader, StatCard, Table, Td, buttonClass } from "@/components/ui";
import { BarList, ColumnChart } from "@/components/charts";
import { BOOKING_STATUS_LABEL, DESTINATION_LABEL, ITEM_TYPE_LABEL, PIPELINE } from "@/lib/labels";
import { AT_RISK_MONTHS } from "@/lib/clients";
import { formatDate, money, toNumber } from "@/lib/format";
import type { BookingStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Reportes" };

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const SOLD: BookingStatus[] = ["BOOKED", "PAID_IN_FULL", "TRAVELED", "COMPLETED"];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ anio?: string; moneda?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const year = Number(sp.anio) || new Date().getFullYear();
  const currency = sp.moneda || user.organization.defaultCurrency;
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31));

  const [soldItems, created, clientsNew, allClients, currencies] = await Promise.all([
    // Ventas = reservas confirmadas con un proveedor, por fecha de venta.
    db.bookingItem.findMany({
      where: {
        status: "CONFIRMED",
        saleDate: { gte: from, lte: to },
        booking: { organizationId: user.organizationId, status: { not: "CANCELLED" }, currency },
      },
      include: { booking: { include: { client: true } } },
    }),
    db.booking.findMany({
      where: { organizationId: user.organizationId, createdAt: { gte: from, lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      select: { status: true },
    }),
    db.client.count({ where: { organizationId: user.organizationId, createdAt: { gte: from, lt: new Date(Date.UTC(year + 1, 0, 1)) } } }),
    db.client.findMany({
      where: { organizationId: user.organizationId, bookings: { some: {} } },
      include: { bookings: { select: { createdAt: true, status: true, totalPrice: true } } },
    }),
    db.booking.findMany({ where: { organizationId: user.organizationId }, distinct: ["currency"], select: { currency: true } }),
  ]);

  const sold = soldItems.map((i) => ({
    bookingId: i.bookingId,
    saleDate: i.saleDate!,
    totalPrice: i.price,
    commissionAmount: i.commissionAmount,
    destination: i.booking.destination,
    client: i.booking.client,
    supplier: i.supplier?.trim() || "Sin proveedor",
    type: i.type,
  }));
  const trips = new Set(sold.map((x) => x.bookingId)).size;
  const revenue = sold.reduce((s, b) => s + toNumber(b.totalPrice), 0);
  const commission = sold.reduce((s, b) => s + toNumber(b.commissionAmount), 0);
  const createdActive = created.filter((b) => b.status !== "CANCELLED");
  const converted = createdActive.filter((b) => SOLD.includes(b.status)).length;
  const conversion = createdActive.length ? Math.round((converted / createdActive.length) * 100) : 0;

  const byMonth = MONTHS.map((label, i) => {
    const value = sold.filter((b) => b.saleDate!.getUTCMonth() === i).reduce((s, b) => s + toNumber(b.commissionAmount), 0);
    return { label, value, display: money(value, currency) };
  });

  function groupBy<K extends string>(key: (b: (typeof sold)[number]) => K, metric: "commission" | "revenue" = "commission") {
    const m = new Map<K, { value: number; count: number; revenue: number }>();
    for (const b of sold) {
      const k = key(b);
      const cur = m.get(k) ?? { value: 0, count: 0, revenue: 0 };
      cur.value += toNumber(metric === "commission" ? b.commissionAmount : b.totalPrice);
      cur.revenue += toNumber(b.totalPrice);
      cur.count++;
      m.set(k, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  }
  const byDestination = groupBy((b) => DESTINATION_LABEL[b.destination]);
  const bySupplier = groupBy((b) => b.supplier);
  const byType = groupBy((b) => ITEM_TYPE_LABEL[b.type]);
  const topClients = groupBy((b) => `${b.client.firstName} ${b.client.lastName}`, "revenue").slice(0, 8);

  const limit = new Date();
  limit.setMonth(limit.getMonth() - AT_RISK_MONTHS);
  const atRisk = allClients
    .map((c) => ({ c, last: c.bookings.reduce((d, b) => (b.createdAt > d ? b.createdAt : d), new Date(0)) }))
    .filter((x) => x.last < limit)
    .sort((a, b) => b.last.getTime() - a.last.getTime())
    .slice(0, 10);

  return (
    <>
      <PageHeader
        title="Reportes"
        description={`Ventas concretadas en ${year} (por fecha de venta), en ${currency}.`}
        actions={
          <form className="flex gap-2">
            <select name="anio" defaultValue={year} className="field w-28">
              {[year + 1, year, year - 1, year - 2, year - 3].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <select name="moneda" defaultValue={currency} className="field w-24">
              {[...new Set([currency, ...currencies.map((c) => c.currency)])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button className={buttonClass("primary")}>Ver</button>
            <Link href="/app/viajes/export" className={buttonClass("secondary")}>
              CSV
            </Link>
          </form>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Vendido" value={money(revenue, currency)} hint={`${sold.length} reservas en ${trips} viajes`} />
        <StatCard label="Comisión" value={money(commission, currency)} tone="good" />
        <StatCard label="Promedio por viaje" value={money(trips ? revenue / trips : 0, currency)} />
        <StatCard label="Conversión" value={`${conversion}%`} hint={`${converted} de ${createdActive.length} consultas del año`} />
        <StatCard label="Clientes nuevos" value={clientsNew} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader title="Comisión por mes" description="Pasá el mouse por cada columna para ver el monto." />
          <div className="p-5">
            <ColumnChart data={byMonth} title={`Comisión por mes ${year}`} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Comisión por destino" />
          <div className="p-5">
            <BarList title="Comisión por destino" data={byDestination.map(([label, v]) => ({ label, value: v.value, display: money(v.value, currency) }))} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Comisión por proveedor" description="Disney, Universal, rentadoras, hoteles…" />
          <div className="p-5">
            <BarList title="Comisión por proveedor" data={bySupplier.slice(0, 10).map(([label, v]) => ({ label, value: v.value, display: money(v.value, currency) }))} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Comisión por tipo de reserva" />
          <div className="p-5">
            <BarList title="Comisión por tipo de reserva" data={byType.map(([label, v]) => ({ label, value: v.value, display: money(v.value, currency) }))} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Embudo del año" description="Viajes creados en el año según su estado actual" />
          <Table>
            <tbody className="divide-y divide-slate-100">
              {[...PIPELINE, "CANCELLED" as const].map((s) => (
                <tr key={s}>
                  <Td>{BOOKING_STATUS_LABEL[s]}</Td>
                  <Td className="text-right tabular-nums">{created.filter((b) => b.status === s).length}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Mejores clientes del año" />
          <Table>
            <tbody className="divide-y divide-slate-100">
              {topClients.map(([name, v]) => (
                <tr key={name}>
                  <Td>{name}</Td>
                  <Td className="text-right text-xs text-slate-500">{v.count} ventas</Td>
                  <Td className="text-right tabular-nums">{money(v.revenue, currency)}</Td>
                </tr>
              ))}
              {topClients.length === 0 && (
                <tr>
                  <Td className="text-slate-500">Sin ventas en el período.</Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Clientes para reactivar" description={`Sin viajes nuevos hace más de ${AT_RISK_MONTHS} meses`} />
          <ul className="divide-y divide-slate-100 text-sm">
            {atRisk.map(({ c, last }) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-2.5">
                <Link href={`/app/clientes/${c.id}`} className="text-slate-800 hover:text-brand-700">
                  {c.firstName} {c.lastName}
                </Link>
                <span className="text-xs text-slate-500">Último viaje: {formatDate(last)}</span>
              </li>
            ))}
            {atRisk.length === 0 && <li className="px-5 py-3 text-slate-500">¡Ninguno! Todos tus clientes viajaron o consultaron hace poco.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
