import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { Download, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Alert, Badge, Card, CardHeader, Field, Input, PageHeader, Table, Td, Textarea, Th, buttonClass } from "@/components/ui";
import { DESTINATION_LABEL, ITEM_TYPE_LABEL, STATEMENT_STATUS_LABEL } from "@/lib/labels";
import { formatDate, formatRange, money, toNumber } from "@/lib/format";
import { loadStatement, statementTotals } from "@/lib/commissions";
import {
  deleteStatement,
  emailStatement,
  markStatementPaid,
  registerPayment,
  setStatementAgency,
  markStatementSent,
  removeStatementItem,
  updateStatementItem,
  updateStatementNotes,
} from "../../actions";
import { PrintButton } from "../../widgets";
import { DateInput } from "@/components/date-input";

export const metadata = { title: "Planilla de comisiones" };

export default async function StatementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ omitidas?: string }> }) {
  const { id } = await params;
  const { omitidas } = await searchParams;
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
          description={`${formatDate(s.periodFrom)} al ${formatDate(s.periodTo)} · por ${basis} · ${s.items.filter((i) => !i.cancelledAt).length} reservas · ${s.sentAt ? `enviada el ${formatDate(s.sentAt)}` : "todavía no enviada"}`}
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

      <div className="mb-4 space-y-3 print:hidden">
        {omitidas && (
          <Alert tone="info">
            {omitidas === "1" ? "1 reserva elegida ya estaba" : `${omitidas} reservas elegidas ya estaban`} en otra planilla y {omitidas === "1" ? "quedó" : "quedaron"} afuera: cada venta se reclama una sola vez.
          </Alert>
        )}
        {!s.agency && (
          <Alert tone="warn">
            Esta planilla no tiene agencia.{" "}
            {user.organization.agency ? (
              <form action={setStatementAgency.bind(null, s.id)} className="inline">
                <button className="font-medium underline">Asignarla a {user.organization.agency.name}</button>
              </form>
            ) : (
              <Link href="/app/configuracion?tab=agencia" className="font-medium underline">
                Cargá tu agencia en Configuración
              </Link>
            )}
          </Alert>
        )}
        {!s.sentAt && <Alert tone="warn">Todavía no la enviaste: las comisiones quedan sin solicitar hasta que la mandes a la agencia.</Alert>}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {totals.map((t) => (
          <Card key={t.currency} className="p-4 sm:col-span-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Comisión reclamada ({t.currency})</p>
                <p className="text-2xl font-semibold">{money(t.expected, t.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Cobrado</p>
                <p className="text-2xl font-semibold text-emerald-700">{money(t.received, t.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t.received > t.expected + 0.005 ? "Pagó de más" : "Diferencia a reclamar"}</p>
                <p className={clsx("text-2xl font-semibold", t.pending > 0 ? "text-amber-700" : "text-slate-500")}>
                  {money(t.received > t.expected ? t.received - t.expected : t.pending, t.currency)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <Table>
          <thead>
            <tr>
              <Th>Venta</Th>
              <Th>Reserva</Th>
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
              const partial = !paid && r.commissionPaidAmount !== null;
              return (
                <tr key={item.id} className={clsx("align-top", paid && "bg-emerald-50/50", item.cancelledAt && "opacity-60")}>
                  <Td className="min-w-40">
                    <Link href={`/app/viajes/${b.id}?tab=reservas`} className="font-medium text-slate-900 hover:text-brand-700">
                      {b.client.firstName} {b.client.lastName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {b.code} · {DESTINATION_LABEL[b.destination]}
                    </p>
                  </Td>
                  <Td className="min-w-52 text-xs">
                    <p className="text-sm text-slate-800">{r.description}</p>
                    <p className="text-slate-500">{[ITEM_TYPE_LABEL[r.type], r.supplier, r.confirmationNumber && `Conf. ${r.confirmationNumber}`].filter(Boolean).join(" · ")}</p>
                    {r.saleDate && <p className="text-slate-500">Vendida el {formatDate(r.saleDate)}</p>}
                  </Td>
                  <Td className="text-xs whitespace-nowrap">{formatRange(b.startDate, b.endDate)}</Td>
                  <Td className="text-right whitespace-nowrap">{money(r.price, b.currency)}</Td>
                  <Td className="text-right font-medium whitespace-nowrap">
                    <span className={clsx(item.cancelledAt && "line-through")}>{money(item.expectedAmount, b.currency)}</span>
                    {item.cancelledAt && <p className="text-[11px] font-normal text-rose-700">{paid || partial ? "Cancelada: a devolver" : "Cancelada: no cuenta"}</p>}
                    {partial && !item.cancelledAt && <p className="text-[11px] font-normal text-amber-700">Cobrado {money(r.commissionPaidAmount, b.currency)}</p>}
                    {!item.cancelledAt && r.statementItems.some((x) => x.statementId !== s.id) && (
                      <Link href={`/app/comisiones/planillas/${r.statementItems.find((x) => x.statementId !== s.id)!.statementId}`} className="block text-[11px] font-normal text-rose-700 hover:underline">
                        También en otra planilla
                      </Link>
                    )}
                  </Td>
                  <Td className="print:hidden">
                    {item.cancelledAt ? (
                      <span className="text-xs text-slate-500">—</span>
                    ) : paid ? (
                      // Cobrada: se ve cuándo y cuánto, y se puede deshacer.
                      <ActionForm action={updateStatementItem.bind(null, s.id, r.id)} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-emerald-800">
                          Cobrada el {formatDate(r.commissionPaidAt)} · {money(r.commissionPaidAmount ?? item.expectedAmount, b.currency)}
                        </span>
                        <SubmitButton size="sm" variant="ghost" pendingText="…">
                          Deshacer
                        </SubmitButton>
                      </ActionForm>
                    ) : (
                      // Un solo botón: marca cobrada por lo esperado y hoy; otro monto o fecha, plegado.
                      <ActionForm action={updateStatementItem.bind(null, s.id, r.id)} className="flex min-w-36 flex-col items-start gap-1.5">
                        <input type="hidden" name="paid" value="on" />
                        <SubmitButton size="sm" variant="secondary" pendingText="…" className="whitespace-nowrap">
                          Marcar cobrada
                        </SubmitButton>
                        <details className="text-xs">
                          <summary className="cursor-pointer whitespace-nowrap text-brand-700 hover:underline">Otro monto o fecha</summary>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <DateInput name="paidAt" className="w-36" size="sm" />
                            <input type="number" step="0.01" name="amount" placeholder={toNumber(item.expectedAmount).toFixed(2)} className="field w-28 py-1 text-xs" title="Monto cobrado (vacío = el esperado)" />
                          </div>
                        </details>
                      </ActionForm>
                    )}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 print:hidden">
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
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-800">Registrar pago recibido</p>
                  <p className="mb-3 text-xs text-slate-500">Lo que transfirió la agencia. Se reparte entre las reservas en orden y lo que falte queda como diferencia a reclamar.</p>
                  <ActionForm action={registerPayment.bind(null, s.id)} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Field label="Monto">
                      <Input type="number" step="0.01" min={0.01} name="amount" defaultValue={totals[0] ? totals[0].pending.toFixed(2) : ""} required />
                    </Field>
                    <Field label="Fecha">
                      <DateInput name="paidAt" />
                    </Field>
                    <Field label="Referencia">
                      <Input name="reference" placeholder="N° de transferencia" />
                    </Field>
                    <div className="sm:col-span-3">
                      <SubmitButton>Registrar pago</SubmitButton>
                    </div>
                  </ActionForm>
                </div>
              )}
              {s.status !== "PAID" && (
                <form action={markStatementPaid.bind(null, s.id)} className="border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs text-slate-500">Si la agencia pagó todo lo reclamado, marcá la planilla completa de una vez (por el total esperado y con fecha de hoy).</p>
                  <SubmitButton variant="secondary">Marcar todas las comisiones como cobradas</SubmitButton>
                </form>
              )}
              {s.payments.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-800">Pagos recibidos</p>
                  <ul className="divide-y divide-slate-100 text-sm">
                    {s.payments.map((pay) => (
                      <li key={pay.id} className="flex justify-between gap-3 py-1.5">
                        <span className="text-slate-600">
                          {formatDate(pay.paidAt)}
                          {pay.reference && ` · ${pay.reference}`}
                        </span>
                        <span className="font-medium text-emerald-700 tabular-nums">{money(pay.amount, totals[0]?.currency ?? "USD")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
