import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAgencyUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Card, CardHeader, Field, Input, PageHeader, Table, Td, Th } from "@/components/ui";
import { DateInput } from "@/components/date-input";
import { DESTINATION_LABEL, ITEM_TYPE_LABEL } from "@/lib/labels";
import { formatDate, formatRange, money, toNumber } from "@/lib/format";
import { receivedOf } from "@/lib/commissions";
import { agencyRegisterPayment } from "../actions";

export const metadata = { title: "Planilla de comisiones" };

export default async function AgencyStatement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAgencyUser();
  const s = await db.commissionStatement.findFirst({
    where: { id, agencyId: user.agencyId, sentAt: { not: null } },
    include: {
      organization: { select: { name: true } },
      agent: { select: { name: true } },
      payments: { orderBy: { paidAt: "asc" } },
      items: { include: { bookingItem: { include: { booking: { include: { client: { select: { firstName: true, lastName: true } } } } } } } },
    },
  });
  if (!s) notFound();
  const rows = s.items.filter((r) => !r.cancelledAt);
  const currency = rows[0]?.bookingItem.booking.currency ?? "USD";
  const expected = rows.reduce((t, r) => t + toNumber(r.expectedAmount), 0);
  const received = rows.reduce((t, r) => t + receivedOf(r.bookingItem, toNumber(r.expectedAmount)), 0);
  const owed = Math.max(0, expected - received);
  return (
    <>
      <PageHeader
        back={{ href: "/agencia/planillas", label: "Planillas" }}
        title={`${s.agent?.name ?? s.organization.name}: ${formatDate(s.periodFrom)} al ${formatDate(s.periodTo)}`}
        description={`Recibida el ${formatDate(s.sentAt)} · reclamado ${money(expected, currency)} · pagado ${money(received, currency)} · falta ${money(owed, currency)}`}
      />
      <Card className="mb-6">
        <Table>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Reserva</Th>
              <Th>Viaje</Th>
              <Th className="text-right">Importe</Th>
              <Th className="text-right">Comisión</Th>
              <Th className="text-right">Pagado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const i = r.bookingItem;
              return (
                <tr key={r.id}>
                  <Td>
                    {i.booking.client.firstName} {i.booking.client.lastName}
                    <p className="text-xs text-slate-500">
                      {i.booking.code} · {DESTINATION_LABEL[i.booking.destination]}
                    </p>
                  </Td>
                  <Td className="text-sm">
                    {i.description}
                    <p className="text-xs text-slate-500">{[ITEM_TYPE_LABEL[i.type], i.supplier, i.confirmationNumber && `Conf. ${i.confirmationNumber}`].filter(Boolean).join(" · ")}</p>
                  </Td>
                  <Td className="text-xs whitespace-nowrap">{formatRange(i.booking.startDate, i.booking.endDate)}</Td>
                  <Td className="text-right whitespace-nowrap">{money(i.price, currency)}</Td>
                  <Td className="text-right font-medium whitespace-nowrap">{money(r.expectedAmount, currency)}</Td>
                  <Td className="text-right whitespace-nowrap text-emerald-700">{money(receivedOf(i, toNumber(r.expectedAmount)), currency)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {owed > 0 && (
          <Card>
            <CardHeader title="Registrar una transferencia" description="Se reparte entre las reservas y el agente recibe un aviso." />
            <ActionForm action={agencyRegisterPayment.bind(null, s.id)} className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
              <Field label="Monto">
                <Input type="number" step="0.01" min={0.01} name="amount" defaultValue={owed.toFixed(2)} required />
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
          </Card>
        )}
        {s.payments.length > 0 && (
          <Card>
            <CardHeader title="Pagos registrados" />
            <ul className="divide-y divide-slate-100 px-5 pb-3 text-sm">
              {s.payments.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <span className="text-slate-600">
                    {formatDate(p.paidAt)}
                    {p.reference && ` · ${p.reference}`}
                  </span>
                  <span className="font-medium text-emerald-700">{money(p.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
