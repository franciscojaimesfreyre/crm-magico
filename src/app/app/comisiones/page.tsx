import Link from "next/link";
import clsx from "clsx";
import { FileSpreadsheet, History } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/form-controls";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, Select, StatCard, StatStrip, Table, Td, Th, buttonClass } from "@/components/ui";
import { COMMISSION_STATUS_COLOR, COMMISSION_STATUS_LABEL, DESTINATION_LABEL, DESTINATION_TONE, ITEM_TYPE_LABEL } from "@/lib/labels";
import { formatDate, formatRange, money, toNumber } from "@/lib/format";
import { commissionWhere, receivedOf, type CommissionFilters } from "@/lib/commissions";
import { CommissionsOverview } from "./overview";
import { createStatement, markCommissionsPaid, markCommissionsPending } from "./actions";
import { SelectAll } from "./widgets";
import { DateInput } from "@/components/date-input";

export const metadata = { title: "Comisiones" };

const ESTADOS = [
  { value: "pendientes", label: "Sin cobrar" },
  { value: "solicitadas", label: "Solicitadas" },
  { value: "cobradas", label: "Cobradas" },
  { value: "todas", label: "Todas" },
];

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<CommissionFilters & { error?: string; vista?: string }> }) {
  const user = await requireUser();
  const { vista, ...sp } = await searchParams;
  const agency = user.organization.agency;
  const header = (
    <>
      <PageHeader
        title="Comisiones"
        description={`Qué podés pedir, qué espera pago y cuándo vas a cobrar${agency ? ` de ${agency.name}` : ""}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-full bg-white p-1 ring-1 ring-[var(--border)]">
              {[
                { key: undefined, label: "Seguimiento" },
                { key: "todas", label: "Listado" },
              ].map((v) => (
                <Link
                  key={v.label}
                  href={v.key ? `/app/comisiones?vista=${v.key}` : "/app/comisiones"}
                  className={clsx("rounded-full px-4 py-1.5 text-sm font-medium", vista === v.key ? "bg-[var(--night)] text-[var(--ground)]" : "text-slate-600 hover:text-slate-900")}
                >
                  {v.label}
                </Link>
              ))}
            </div>
            <LinkButton href="/app/comisiones/planillas" variant="secondary">
              <History className="size-4" /> Planillas
            </LinkButton>
          </div>
        }
      />
      {!agency && (
        <div className="mb-4">
          <Alert tone="warn">
            Todavía no cargaste la agencia que te paga las comisiones. Hacelo en{" "}
            <Link href="/app/configuracion?tab=agencia" className="font-medium underline">
              Configuración → Mi agencia
            </Link>{" "}
            para que aparezca en tus planillas.
          </Alert>
        </div>
      )}
      {sp.error === "ya-en-planilla" && (
        <div className="mb-4">
          <Alert tone="error">Las ventas elegidas ya están en otra planilla: cada venta se reclama una sola vez.</Alert>
        </div>
      )}
      {sp.error === "sin-seleccion" && (
        <div className="mb-4">
          <Alert tone="error">Seleccioná al menos una venta.</Alert>
        </div>
      )}
    </>
  );
  if (vista !== "todas") {
    return (
      <>
        {header}
        <CommissionsOverview organizationId={user.organizationId} agency={agency ? { name: agency.name, paymentTermDays: agency.paymentTermDays } : null} />
      </>
    );
  }
  const f: CommissionFilters = { estado: "pendientes", base: "venta", ...sp };
  // Cada fila es una reserva confirmada (una venta): un viaje puede aportar varias.
  const include = {
    booking: { include: { client: { select: { firstName: true, lastName: true } } } },
    statementItems: { where: { cancelledAt: null }, select: { statementId: true } },
  } as const;
  const [items, allForTotals] = await Promise.all([
    db.bookingItem.findMany({
      where: commissionWhere(user.organizationId, f),
      include,
      orderBy: [{ saleDate: { sort: "asc", nulls: "last" } }, { booking: { code: "asc" } }, { position: "asc" }],
    }),
    // Los totales no dependen del filtro de estado: ganado = cobrado + por cobrar, siempre.
    db.bookingItem.findMany({ where: commissionWhere(user.organizationId, { ...f, estado: "todas" }), include }),
  ]);

  // Totales por moneda.
  const totals = new Map<string, { commission: number; paid: number; pending: number; sales: number }>();
  for (const i of allForTotals) {
    const cur = i.booking.currency;
    const t = totals.get(cur) ?? { commission: 0, paid: 0, pending: 0, sales: 0 };
    t.sales += toNumber(i.price);
    t.commission += toNumber(i.commissionAmount);
    const received = receivedOf(i);
    t.paid += received;
    t.pending += Math.max(0, toNumber(i.commissionAmount) - received);
    totals.set(cur, t);
  }
  const main = [...totals.entries()][0];
  const returnTo = `/app/comisiones?vista=todas&${new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== "error") as [string, string][])}`;

  return (
    <>
      {header}
      <form className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="vista" value="todas" />
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2 lg:order-last lg:col-span-4">
          <input type="checkbox" name="realizados" value="1" defaultChecked={f.realizados === "1"} className="size-4 rounded border-slate-300" />
          Solo viajes ya realizados (la mayoría de las agencias paga después del viaje)
        </label>
        <label>
          <span className="label">Período según</span>
          <Select name="base" defaultValue={f.base} options={[{ value: "venta", label: "Fecha de venta" }, { value: "viaje", label: "Fin del viaje" }]} />
        </label>
        <label>
          <span className="label">Desde</span>
          <DateInput name="desde" defaultValue={f.desde} />
        </label>
        <label>
          <span className="label">Hasta</span>
          <DateInput name="hasta" defaultValue={f.hasta} />
        </label>
        <label>
          <span className="label">Estado</span>
          <div className="flex gap-2">
            <Select name="estado" defaultValue={f.estado} options={ESTADOS} />
            <button className={buttonClass("primary")}>Ver</button>
          </div>
        </label>
      </form>

      {main && (
        <StatStrip className="mb-6">
          <StatCard label="Ganado en el período" value={money(main[1].commission, main[0])} hint={`${allForTotals.length} reservas · vendido ${money(main[1].sales, main[0])}`} />
          <StatCard label="Ya cobrado" value={money(main[1].paid, main[0])} tone="good" />
          <StatCard label="Por cobrar" value={money(main[1].pending, main[0])} tone={main[1].pending > 0 ? "warn" : "default"} />
        </StatStrip>
      )}
      {totals.size > 1 && (
        <p className="-mt-3 mb-4 text-xs text-slate-500">
          Hay ventas en otras monedas:{" "}
          {[...totals.entries()].slice(1).map(([cur, t]) => `${money(t.commission, cur)} (${money(t.pending, cur)} por cobrar)`).join(" · ")}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No hay ventas con estos filtros"
          description="Cada reserva confirmada de un viaje (paquete, tickets, auto, hotel…) es una venta; la fecha de venta se registra al confirmarla. Probá ampliar el período o cambiar el estado."
        />
      ) : (
        <form>
          <input type="hidden" name="returnTo" value={returnTo} />
          {Object.entries(f).map(([k, v]) => v && k !== "error" ? <input key={k} type="hidden" name={k} value={v} /> : null)}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="text-sm text-slate-600">Seleccioná las reservas y elegí qué hacer:</p>
              <div className="flex flex-wrap items-center gap-2">
                <SubmitButton formAction={createStatement} pendingText="Generando…">
                  <FileSpreadsheet className="size-4" /> Generar planilla
                </SubmitButton>
                <DateInput name="paidAt" className="w-40" title="Fecha de cobro (vacío = hoy)" />
                <SubmitButton formAction={markCommissionsPaid} variant="secondary" pendingText="…">
                  Marcar cobradas
                </SubmitButton>
                <SubmitButton formAction={markCommissionsPending} variant="ghost" pendingText="…">
                  Marcar sin cobrar
                </SubmitButton>
              </div>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>
                    <SelectAll />
                  </Th>
                  <Th>Cliente / viaje</Th>
                  <Th>Reserva</Th>
                  <Th>Vendida</Th>
                  <Th className="text-right">Importe</Th>
                  <Th className="text-right">Comisión</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((i) => (
                  <tr key={i.id} className={clsx(i.commissionStatus === "PAID" && "bg-emerald-50/40")}>
                    <Td>
                      {/* Nada viene tildado: en esta lista conviven las ya pedidas y las cobradas. */}
                      <input type="checkbox" name="itemIds" value={i.id} className="size-4 rounded border-slate-300" />
                    </Td>
                    <Td>
                      <Link href={`/app/viajes/${i.bookingId}?tab=reservas`} className="font-medium text-slate-900 hover:text-brand-700">
                        {i.booking.client.firstName} {i.booking.client.lastName}
                      </Link>
                      <p className="flex items-center gap-1.5 text-xs whitespace-nowrap text-slate-500">
                        <span className={clsx("size-2 shrink-0 rounded-full", DESTINATION_TONE[i.booking.destination].dot)} />
                        {i.booking.code} · {DESTINATION_LABEL[i.booking.destination]}
                      </p>
                      <p className="text-xs whitespace-nowrap text-slate-500">{formatRange(i.booking.startDate, i.booking.endDate)}</p>
                    </Td>
                    <Td className="min-w-64">
                      <p className="text-sm font-medium text-slate-800">{i.description}</p>
                      <p className="text-xs text-slate-500">{[ITEM_TYPE_LABEL[i.type], i.supplier, i.confirmationNumber].filter(Boolean).join(" · ")}</p>
                    </Td>
                    <Td className="text-xs whitespace-nowrap">{formatDate(i.saleDate)}</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{money(i.price, i.booking.currency)}</Td>
                    <Td className="text-right font-semibold whitespace-nowrap text-brand-700 tabular-nums">{money(i.commissionAmount, i.booking.currency)}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge className={COMMISSION_STATUS_COLOR[i.commissionStatus]}>{COMMISSION_STATUS_LABEL[i.commissionStatus]}</Badge>
                      {i.commissionPaidAt && <p className="text-[11px] text-slate-500">{formatDate(i.commissionPaidAt)}</p>}
                      {i.statementItems[0] && (
                        <Link href={`/app/comisiones/planillas/${i.statementItems[0].statementId}`} className="block text-[11px] text-brand-700 hover:underline">
                          En una planilla
                        </Link>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </form>
      )}
    </>
  );
}
