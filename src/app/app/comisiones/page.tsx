import Link from "next/link";
import clsx from "clsx";
import { FileSpreadsheet, History } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/form-controls";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, Select, StatCard, Table, Td, Th, buttonClass } from "@/components/ui";
import { COMMISSION_STATUS_COLOR, COMMISSION_STATUS_LABEL, DESTINATION_LABEL, ITEM_TYPE_LABEL } from "@/lib/labels";
import { formatDate, formatRange, money, toNumber } from "@/lib/format";
import { commissionWhere, type CommissionFilters } from "@/lib/commissions";
import { createStatement, markCommissionsPaid, markCommissionsPending } from "./actions";
import { SelectAll } from "./widgets";

export const metadata = { title: "Comisiones" };

const ESTADOS = [
  { value: "pendientes", label: "Sin cobrar" },
  { value: "solicitadas", label: "Solicitadas" },
  { value: "cobradas", label: "Cobradas" },
  { value: "todas", label: "Todas" },
];

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<CommissionFilters & { error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const f: CommissionFilters = { estado: "pendientes", base: "venta", ...sp };
  const agency = user.organization.agency;
  // Cada fila es una reserva confirmada (una venta): un viaje puede aportar varias.
  const [items, statementsCount] = await Promise.all([
    db.bookingItem.findMany({
      where: commissionWhere(user.organizationId, f),
      include: { booking: { include: { client: { select: { firstName: true, lastName: true } } } } },
      orderBy: [{ saleDate: { sort: "asc", nulls: "last" } }, { booking: { code: "asc" } }, { position: "asc" }],
    }),
    db.commissionStatement.count({ where: { organizationId: user.organizationId } }),
  ]);

  // Totales por moneda.
  const totals = new Map<string, { commission: number; paid: number; pending: number; sales: number }>();
  for (const i of items) {
    const cur = i.booking.currency;
    const t = totals.get(cur) ?? { commission: 0, paid: 0, pending: 0, sales: 0 };
    t.sales += toNumber(i.price);
    t.commission += toNumber(i.commissionAmount);
    if (i.commissionStatus === "PAID") t.paid += toNumber(i.commissionPaidAmount ?? i.commissionAmount);
    else t.pending += toNumber(i.commissionAmount);
    totals.set(cur, t);
  }
  const main = [...totals.entries()][0];
  const returnTo = `/app/comisiones?${new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== "error") as [string, string][])}`;

  return (
    <>
      <PageHeader
        title="Comisiones"
        description={
          agency
            ? `Elegí el período, revisá las ventas y generá la planilla para que ${agency.name} te pague. Después marcá lo que ya cobraste.`
            : "Elegí el período, revisá las ventas y generá la planilla para que tu agencia te pague. Después marcá lo que ya cobraste."
        }
        actions={
          <LinkButton href="/app/comisiones/planillas" variant="secondary">
            <History className="size-4" /> Planillas generadas ({statementsCount})
          </LinkButton>
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

      <form className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <input type="date" name="desde" defaultValue={f.desde} className="field" />
        </label>
        <label>
          <span className="label">Hasta</span>
          <input type="date" name="hasta" defaultValue={f.hasta} className="field" />
        </label>
        <label>
          <span className="label">Estado</span>
          <div className="flex gap-2">
            <Select name="estado" defaultValue={f.estado} options={ESTADOS} />
            <button className={buttonClass("primary")}>Ver</button>
          </div>
        </label>
      </form>

      {sp.error === "sin-seleccion" && (
        <div className="mb-4">
          <Alert tone="error">Seleccioná al menos una venta.</Alert>
        </div>
      )}

      {main && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="Comisión del período" value={money(main[1].commission, main[0])} hint={`${items.length} reservas · vendido ${money(main[1].sales, main[0])}`} />
          <StatCard label="Ya cobrado" value={money(main[1].paid, main[0])} tone="good" />
          <StatCard label="Por cobrar" value={money(main[1].pending, main[0])} tone={main[1].pending > 0 ? "warn" : "default"} />
        </div>
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
                <input type="date" name="paidAt" className="field w-40" title="Fecha de cobro (vacío = hoy)" />
                <SubmitButton formAction={markCommissionsPaid} variant="secondary" pendingText="…">
                  Marcar cobradas
                </SubmitButton>
                <SubmitButton formAction={markCommissionsPending} variant="ghost" pendingText="…">
                  Marcar sin cobrar
                </SubmitButton>
              </div>
            </div>
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>
                    <SelectAll defaultChecked={f.estado !== "cobradas"} />
                  </Th>
                  <Th>Cliente / viaje</Th>
                  <Th>Reserva</Th>
                  <Th>Fecha de venta</Th>
                  <Th>Viaje</Th>
                  <Th className="text-right">Importe</Th>
                  <Th className="text-right">Comisión</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((i) => (
                  <tr key={i.id} className={clsx(i.commissionStatus === "PAID" && "bg-emerald-50/40")}>
                    <Td>
                      <input type="checkbox" name="itemIds" value={i.id} defaultChecked={f.estado !== "cobradas" && i.commissionStatus !== "PAID"} className="size-4 rounded border-slate-300" />
                    </Td>
                    <Td>
                      <Link href={`/app/viajes/${i.bookingId}?tab=reservas`} className="font-medium text-slate-900 hover:text-brand-700">
                        {i.booking.client.firstName} {i.booking.client.lastName}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {i.booking.code} · {DESTINATION_LABEL[i.booking.destination]}
                      </p>
                    </Td>
                    <Td className="max-w-xs">
                      <p className="text-sm text-slate-800">{i.description}</p>
                      <p className="text-xs text-slate-500">{[ITEM_TYPE_LABEL[i.type], i.supplier, i.confirmationNumber].filter(Boolean).join(" · ")}</p>
                    </Td>
                    <Td className="text-xs">{formatDate(i.saleDate)}</Td>
                    <Td className="text-xs whitespace-nowrap">{formatRange(i.booking.startDate, i.booking.endDate)}</Td>
                    <Td className="text-right whitespace-nowrap">{money(i.price, i.booking.currency)}</Td>
                    <Td className="text-right font-medium whitespace-nowrap text-emerald-700">{money(i.commissionAmount, i.booking.currency)}</Td>
                    <Td>
                      <Badge className={COMMISSION_STATUS_COLOR[i.commissionStatus]}>{COMMISSION_STATUS_LABEL[i.commissionStatus]}</Badge>
                      {i.commissionPaidAt && <p className="text-[11px] text-slate-400">{formatDate(i.commissionPaidAt)}</p>}
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
