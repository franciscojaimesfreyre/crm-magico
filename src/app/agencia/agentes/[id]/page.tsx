import { notFound } from "next/navigation";
import { requireAgencyUser } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader, StatCard, Table, Td, Th, buttonClass } from "@/components/ui";
import { BOOKING_STATUS_COLOR, BOOKING_STATUS_LABEL, COMMISSION_STATUS_COLOR, COMMISSION_STATUS_LABEL, DESTINATION_LABEL, ITEM_TYPE_LABEL } from "@/lib/labels";
import { formatDate, formatRange, money } from "@/lib/format";
import { agencyAgent, agencyCurrencies, agencySales, summarize } from "@/lib/agency-panel";

export const metadata = { title: "Ventas del agente" };

export default async function AgencyAgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ anio?: string; moneda?: string }>;
}) {
  const user = await requireAgencyUser();
  const { id } = await params;
  const sp = await searchParams;
  const agent = await agencyAgent(user.agencyId, id);
  if (!agent) notFound();
  const year = Number(sp.anio) || new Date().getFullYear();
  const currencies = await agencyCurrencies(user.agencyId);
  const currency = sp.moneda || currencies[0] || "USD";
  const sales = await agencySales(user.agencyId, { year, currency, organizationId: agent.id });
  const t = summarize(sales);

  return (
    <>
      <PageHeader
        title={agent.users[0]?.name ?? agent.name}
        description={[agent.name, agent.contactEmail, agent.contactPhone, `en tu agencia desde ${formatDate(agent.agencyJoinedAt)}`].filter(Boolean).join(" · ")}
        back={{ href: `/agencia?anio=${year}&moneda=${currency}`, label: "Resumen" }}
        actions={
          <form className="flex gap-2">
            <select name="anio" defaultValue={year} className="field w-28" aria-label="Año">
              {[year + 1, year, year - 1, year - 2, year - 3].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <select name="moneda" defaultValue={currency} className="field w-24" aria-label="Moneda">
              {[...new Set([currency, ...currencies])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button className={buttonClass("primary")}>Ver</button>
          </form>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vendido" value={money(t.revenue, currency)} hint={`${t.count} ventas en ${year}`} />
        <StatCard label="Comisiones" value={money(t.commission, currency)} />
        <StatCard label="Ya pagadas" value={money(t.paid, currency)} tone="good" />
        <StatCard label="Por pagar" value={money(t.pending, currency)} tone={t.pending > 0 ? "warn" : "default"} />
      </div>

      {sales.length === 0 ? (
        <EmptyState title={`Sin ventas en ${year} en ${currency}`} description="Cada reserva que el agente confirma con un proveedor cuenta como una venta." />
      ) : (
        <Card>
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Viaje</Th>
                <Th>Reserva</Th>
                <Th>Estado</Th>
                <Th>Fecha de venta</Th>
                <Th>Fechas</Th>
                <Th className="text-right">Importe</Th>
                <Th className="text-right">Comisión</Th>
                <Th>Cobro</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <p className="font-medium text-slate-900">{s.code}</p>
                    <p className="text-xs text-slate-500">{DESTINATION_LABEL[s.destination]}</p>
                  </Td>
                  <Td className="text-xs">
                    {ITEM_TYPE_LABEL[s.type]}
                    {s.supplier && <span className="text-slate-500"> · {s.supplier}</span>}
                  </Td>
                  <Td>
                    <Badge className={BOOKING_STATUS_COLOR[s.status]}>{BOOKING_STATUS_LABEL[s.status]}</Badge>
                  </Td>
                  <Td className="text-xs">{formatDate(s.saleDate)}</Td>
                  <Td className="text-xs whitespace-nowrap">{formatRange(s.startDate, s.endDate)}</Td>
                  <Td className="text-right whitespace-nowrap">{money(s.totalPrice, s.currency)}</Td>
                  <Td className="text-right whitespace-nowrap">{money(s.commissionAmount, s.currency)}</Td>
                  <Td>
                    <Badge className={COMMISSION_STATUS_COLOR[s.commissionStatus]}>{COMMISSION_STATUS_LABEL[s.commissionStatus]}</Badge>
                    {s.commissionPaidAt && <p className="text-[11px] text-slate-400">{formatDate(s.commissionPaidAt)}</p>}
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
