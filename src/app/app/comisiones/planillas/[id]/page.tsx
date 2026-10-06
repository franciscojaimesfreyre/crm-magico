import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { Download, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, Field, Input, PageHeader, Table, Td, Textarea, Th, buttonClass } from "@/components/ui";
import { DESTINATION_LABEL, ITEM_TYPE_LABEL, STATEMENT_STATUS_LABEL } from "@/lib/labels";
import { formatDate, formatRange, money, toDateInput, toNumber } from "@/lib/format";
import { loadStatement, statementTotals } from "@/lib/commissions";
import {
  deleteStatement,
  emailStatement,
  markStatementPaid,
  markStatementSent,
  removeStatementItem,
  updateStatementItem,
  updateStatementNotes,
} from "../../actions";
import { PrintButton } from "../../widgets";

export const metadata = { title: "Planilla de comisiones" };

export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const s = await loadStatement(id, user.organizationId);
  if (!s) notFound();
  const totals = statementTotals(s);
  const basis = s.dateBasis === "TRAVEL_END" ? "fin de viaje" : "fecha de venta";
  const defaultBody = `Hola${s.agency?.contactName ? ` ${s.agency.contactName}` : ""}:

Te envío la planilla de comisiones del período ${formatDate(s.periodFrom)} al ${formatDate(s.periodTo)} (${s.items.length} reservas, total ${totals.map((t) => money(t.expected, t.currency)).join(" + ")}).

Quedo atento/a a la liquidación. ¡Gracias!

${user.name}
${user.organization.name}`;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          back={{ href: "/app/comisiones/planillas", label: "Planillas" }}
          title={`Planilla — ${s.agency?.name ?? "Sin agencia"}`}
          description={`${formatDate(s.periodFrom)} al ${formatDate(s.periodTo)} · por ${basis} · ${s.items.length} reservas`}
          actions={
            <>
              <Badge className="bg-brand-100 text-brand-700">{STATEMENT_STATUS_LABEL[s.status]}</Badge>
              <a href={`/app/comisiones/planillas/${s.id}/excel`} className={buttonClass("primary")}>
                <Download className="size-4" /> Excel
              </a>
              <PrintButton />
            </>
          }
        />
      </div>

      {/* Encabezado solo para impresión */}
      <div className="mb-6 hidden print:block">
        <h1 className="text-2xl font-semibold">Planilla de comisiones</h1>
        <p className="text-sm">
          {user.organization.name} · Agente: {s.agent?.name ?? "—"} · Agencia: {s.agency?.name ?? "—"}
        </p>
        <p className="text-sm">
          Período: {formatDate(s.periodFrom)} al {formatDate(s.periodTo)} (por {basis})
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {totals.map((t) => (
          <Card key={t.currency} className="p-4 sm:col-span-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500 uppercase">Comisión total ({t.currency})</p>
                <p className="text-2xl font-semibold">{money(t.expected, t.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Cobrado</p>
                <p className="text-2xl font-semibold text-emerald-600">{money(t.received, t.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Pendiente</p>
                <p className={clsx("text-2xl font-semibold", t.pending > 0 ? "text-amber-600" : "text-slate-400")}>{money(t.pending, t.currency)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Venta</Th>
              <Th>Reserva</Th>
              <Th>Fecha de venta</Th>
              <Th>Viaje</Th>
              <Th className="text-right">Importe</Th>
              <Th className="text-right">Comisión</Th>
              <Th className="print:hidden">Cobro</Th>
              <Th className="hidden print:table-cell">Estado</Th>
              <Th className="print:hidden" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {s.items.map((item) => {
              const r = item.bookingItem;
              const b = r.booking;
              const paid = r.commissionStatus === "PAID";
              return (
                <tr key={item.id} className={clsx("align-top", paid && "bg-emerald-50/50")}>
                  <Td className="min-w-40">
                    <Link href={`/app/viajes/${b.id}?tab=reservas`} className="font-medium text-slate-900 hover:text-brand-700">
                      {b.client.firstName} {b.client.lastName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {b.code} · {DESTINATION_LABEL[b.destination]}
                    </p>
                  </Td>
                  <Td className="min-w-64 text-xs">
                    <p className="text-sm text-slate-800">{r.description}</p>
                    <p className="text-slate-500">{[ITEM_TYPE_LABEL[r.type], r.supplier, r.confirmationNumber && `Conf. ${r.confirmationNumber}`].filter(Boolean).join(" · ")}</p>
                  </Td>
                  <Td className="text-xs">{formatDate(r.saleDate)}</Td>
                  <Td className="text-xs whitespace-nowrap">{formatRange(b.startDate, b.endDate)}</Td>
                  <Td className="text-right whitespace-nowrap">{money(r.price, b.currency)}</Td>
                  <Td className="text-right font-medium whitespace-nowrap">{money(item.expectedAmount, b.currency)}</Td>
                  <Td className="print:hidden">
                    <ActionForm action={updateStatementItem.bind(null, s.id, r.id)} className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" name="paid" defaultChecked={paid} className="size-4 rounded border-slate-300 text-emerald-600" />
                        Cobrada
                      </label>
                      <input type="date" name="paidAt" defaultValue={toDateInput(r.commissionPaidAt)} className="field w-36 py-1 text-xs" />
                      <input
                        type="number"
                        step="0.01"
                        name="amount"
                        defaultValue={r.commissionPaidAmount?.toString() ?? ""}
                        placeholder={toNumber(item.expectedAmount).toFixed(2)}
                        className="field w-28 py-1 text-xs"
                        title="Monto cobrado (vacío = el esperado)"
                      />
                      <SubmitButton size="sm" variant="secondary" pendingText="…">
                        OK
                      </SubmitButton>
                    </ActionForm>
                  </Td>
                  <Td className="hidden text-xs print:table-cell">{paid ? `Cobrada ${formatDate(r.commissionPaidAt)}` : "Pendiente"}</Td>
                  <Td className="print:hidden">
                    <form action={removeStatementItem.bind(null, s.id, r.id)}>
                      <ConfirmButton variant="ghost" message="¿Quitar esta venta de la planilla?">
                        <Trash2 className="size-3.5" />
                      </ConfirmButton>
                    </form>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 print:hidden">
        <Card>
          <CardHeader title="Enviar a la agencia" description="Se adjunta la planilla en Excel." />
          <ActionForm action={emailStatement.bind(null, s.id)} className="space-y-3 p-5">
            <Field label="Para">
              <Input name="to" type="email" defaultValue={s.agency?.contactEmail ?? ""} required />
            </Field>
            <Field label="Asunto">
              <Input name="subject" defaultValue={`Planilla de comisiones ${formatDate(s.periodFrom)} – ${formatDate(s.periodTo)} — ${user.name}`} />
            </Field>
            <Field label="Mensaje">
              <Textarea name="body" rows={8} defaultValue={defaultBody} />
            </Field>
            <SubmitButton pendingText="Enviando…">Enviar con Excel adjunto</SubmitButton>
          </ActionForm>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Acciones" />
            <div className="space-y-4 p-5">
              {s.status === "DRAFT" && (
                <form action={markStatementSent.bind(null, s.id)}>
                  <SubmitButton variant="secondary">Marcar como enviada (la mandé por otro medio)</SubmitButton>
                </form>
              )}
              {s.status !== "PAID" && (
                <form action={markStatementPaid.bind(null, s.id)} className="flex flex-wrap items-end gap-2">
                  <Field label="Fecha de cobro">
                    <Input type="date" name="paidAt" />
                  </Field>
                  <SubmitButton>Marcar toda la planilla como cobrada</SubmitButton>
                </form>
              )}
              <form action={deleteStatement.bind(null, s.id)}>
                <ConfirmButton message="¿Eliminar la planilla? Las ventas vuelven a quedar pendientes de solicitar.">
                  <Trash2 className="size-3.5" /> Eliminar planilla
                </ConfirmButton>
              </form>
            </div>
          </Card>
          <Card>
            <CardHeader title="Notas" />
            <form action={updateStatementNotes.bind(null, s.id)} className="space-y-3 p-5">
              <Textarea name="notes" defaultValue={s.notes ?? ""} placeholder="Ej: la agencia liquida el 10 de cada mes por transferencia" />
              <SubmitButton size="sm" variant="secondary">
                Guardar notas
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
