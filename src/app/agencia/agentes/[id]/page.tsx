import { notFound } from "next/navigation";
import { requireAgencyUser } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader, StatCard, StatStrip, Table, Td, Th, buttonClass } from "@/components/ui";
import { BOOKING_STATUS_COLOR, BOOKING_STATUS_LABEL, COMMISSION_STATUS_COLOR, COMMISSION_STATUS_LABEL, DESTINATION_LABEL, ITEM_TYPE_LABEL } from "@/lib/labels";
import { formatDate, formatRange, money } from "@/lib/format";
import { agencyAgent, agencyCurrencies, agencySales, summarize } from "@/lib/agency-panel";
import { SelectField } from "@/components/select-field";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Input } from "@/components/ui";
import { setAgentShare } from "./actions";

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
  const t = summarize(sales, agent.agentSharePercent ?? user.agency.agentSharePercent);

  return (
    <>
      <PageHeader
        title={agent.users[0]?.name ?? agent.name}
        description={[agent.name, agent.contactEmail, agent.contactPhone, `en tu agencia desde ${formatDate(agent.agencyJoinedAt)}`].filter(Boolean).join(" · ")}
        back={{ href: `/agencia?anio=${year}&moneda=${currency}`, label: "Resumen" }}
        actions={
          <form className="flex gap-2">
            <SelectField name="anio" defaultValue={String(year)} className="w-28" aria-label="Año" options={[year + 1, year, year - 1, year - 2, year - 3].map((y) => ({ value: String(y), label: String(y) }))} />
            <SelectField name="moneda" defaultValue={currency} className="w-24" aria-label="Moneda" options={[...new Set([currency, ...currencies])].map((c) => ({ value: c, label: c }))} />
            <button className={buttonClass("primary")}>Ver</button>
          </form>
        }
      />

      <StatStrip className="mb-6">
        <StatCard label="Vendido" value={money(t.revenue, currency)} hint={`${t.count} ventas en ${year}`} />
        <StatCard label="Comisiones de proveedores" value={money(t.commission, currency)} hint={t.retained > 0.005 ? `Retenés ${money(t.retained, currency)} · al agente ${money(t.toAgents, currency)}` : undefined} />
        <StatCard label="Ya transferido" value={money(t.paid, currency)} tone="good" />
        <StatCard label="Falta transferir" value={money(t.pending, currency)} tone={t.pending > 0 ? "warn" : "default"} />
      </StatStrip>

      <Card className="mb-6">
        <ActionForm action={setAgentShare.bind(null, agent.id)} className="flex flex-wrap items-end gap-3 p-5">
          <label className="w-56">
            <span className="label">Parte de este agente (%)</span>
            <Input name="agentSharePercent" type="number" step="0.01" min={0} max={100} defaultValue={agent.agentSharePercent?.toString() ?? ""} placeholder={user.agency.agentSharePercent?.toString() ?? "100"} />
          </label>
          <p className="flex-1 basis-64 pb-2 text-xs text-slate-500">
            Lo que le transferís de la comisión que pagan los proveedores. Vacío = la general de la agencia ({user.agency.agentSharePercent?.toString() ?? "100"} %).
          </p>
          <SubmitButton size="sm">Guardar</SubmitButton>
        </ActionForm>
      </Card>

      {sales.length === 0 ? (
        <EmptyState title={`Sin ventas en ${year} en ${currency}`} description="Cada reserva que el agente confirma con un proveedor cuenta como una venta." />
      ) : (
        <Card>
          <Table>
            <thead>
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
                    {s.commissionPaidAt && <p className="text-[11px] text-slate-500">{formatDate(s.commissionPaidAt)}</p>}
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
