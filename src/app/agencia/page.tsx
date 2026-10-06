import Link from "next/link";
import { Users } from "lucide-react";
import { requireAgencyUser } from "@/lib/auth";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, StatCard, Table, Td, Th, buttonClass } from "@/components/ui";
import { BarList, ColumnChart } from "@/components/charts";
import { DESTINATION_LABEL } from "@/lib/labels";
import { formatDate, money, toNumber } from "@/lib/format";
import { agencyAgents, agencyCurrencies, agencySales, summarize } from "@/lib/agency-panel";

export const metadata = { title: "Resumen de la agencia" };

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default async function AgencyDashboard({ searchParams }: { searchParams: Promise<{ anio?: string; moneda?: string }> }) {
  const user = await requireAgencyUser();
  const sp = await searchParams;
  const year = Number(sp.anio) || new Date().getFullYear();
  const [agents, currencies] = await Promise.all([agencyAgents(user.agencyId), agencyCurrencies(user.agencyId)]);
  const currency = sp.moneda || currencies[0] || "USD";
  const sales = await agencySales(user.agencyId, { year, currency });

  if (agents.length === 0) {
    return (
      <>
        <PageHeader title={user.agency.name} />
        <EmptyState
          title="Todavía no hay agentes en tu agencia"
          description={`Pasales tu código de invitación (${user.agency.inviteCode}) o el link de registro. Cuando se unan, vas a ver acá sus ventas y comisiones.`}
          action={<LinkButton href="/agencia/configuracion">Ver código e invitación</LinkButton>}
        />
      </>
    );
  }

  const total = summarize(sales);
  const byAgent = agents
    .map((a) => ({ agent: a, ...summarize(sales.filter((s) => s.organizationId === a.id)) }))
    .sort((a, b) => b.revenue - a.revenue);
  const byMonth = MONTHS.map((label, i) => {
    const value = summarize(sales.filter((s) => s.saleDate!.getUTCMonth() === i)).revenue;
    return { label, value, display: money(value, currency) };
  });
  const destinations = new Map<string, number>();
  for (const s of sales) {
    const label = DESTINATION_LABEL[s.destination];
    destinations.set(label, (destinations.get(label) ?? 0) + toNumber(s.totalPrice));
  }

  return (
    <>
      <PageHeader
        title={user.agency.name}
        description={`Ventas concretadas de tus agentes en ${year} (por fecha de venta), en ${currency}. Solo lectura: cada agente gestiona sus propios datos.`}
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

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Vendido" value={money(total.revenue, currency)} hint={`${total.count} ventas`} />
        <StatCard label="Comisiones" value={money(total.commission, currency)} />
        <StatCard label="Ya pagadas" value={money(total.paid, currency)} tone="good" />
        <StatCard label="Por pagar" value={money(total.pending, currency)} tone={total.pending > 0 ? "warn" : "default"} />
        <StatCard label="Agentes" value={agents.length} hint={`${byAgent.filter((a) => a.count > 0).length} con ventas en ${year}`} />
      </div>

      <Card className="mb-6">
        <CardHeader title="Por agente" description="Comisiones según lo que cada agente marcó como cobrado." />
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Agente</Th>
              <Th className="text-right">Ventas</Th>
              <Th className="text-right">Vendido</Th>
              <Th className="text-right">Comisión</Th>
              <Th className="text-right">Pagada</Th>
              <Th className="text-right">Por pagar</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {byAgent.map(({ agent, ...t }) => (
              <tr key={agent.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/agencia/agentes/${agent.id}?anio=${year}&moneda=${currency}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {agent.users[0]?.name ?? agent.name}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {agent.name} · desde {formatDate(agent.agencyJoinedAt)}
                  </p>
                </Td>
                <Td className="text-right tabular-nums">{t.count}</Td>
                <Td className="text-right tabular-nums">{money(t.revenue, currency)}</Td>
                <Td className="text-right tabular-nums">{money(t.commission, currency)}</Td>
                <Td className="text-right tabular-nums text-emerald-700">{money(t.paid, currency)}</Td>
                <Td className="text-right tabular-nums">{t.pending > 0 ? <span className="text-amber-700">{money(t.pending, currency)}</span> : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Vendido por mes" />
          <div className="p-5">
            <ColumnChart data={byMonth} title={`Vendido por mes ${year}`} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Vendido por destino" />
          <div className="p-5">
            <BarList
              title="Vendido por destino"
              data={[...destinations.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, display: money(value, currency) }))}
            />
          </div>
        </Card>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-slate-500">
        <Users className="size-3.5" /> Ves los números de los agentes que trabajan hoy con tu agencia. Los datos de sus clientes son privados.
      </p>
    </>
  );
}
