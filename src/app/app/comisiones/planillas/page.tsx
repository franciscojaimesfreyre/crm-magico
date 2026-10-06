import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";
import { STATEMENT_STATUS_LABEL } from "@/lib/labels";
import { formatDate, money, toNumber } from "@/lib/format";

export const metadata = { title: "Planillas de comisiones" };

const STATUS_COLOR = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-sky-100 text-sky-800",
  PARTIALLY_PAID: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
} as const;

export default async function StatementsPage() {
  const user = await requireUser();
  const statements = await db.commissionStatement.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      agency: true,
      items: {
        include: { bookingItem: { select: { commissionStatus: true, commissionPaidAmount: true, booking: { select: { currency: true } } } } },
      },
    },
  });
  return (
    <>
      <PageHeader
        title="Planillas de comisiones"
        back={{ href: "/app/comisiones", label: "Comisiones" }}
        actions={<LinkButton href="/app/comisiones">Nueva planilla</LinkButton>}
      />
      {statements.length === 0 ? (
        <EmptyState title="Todavía no generaste planillas" action={<LinkButton href="/app/comisiones">Generar la primera</LinkButton>} />
      ) : (
        <Card>
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Agencia</Th>
                <Th>Período</Th>
                <Th className="text-right">Ventas</Th>
                <Th className="text-right">Comisión</Th>
                <Th className="text-right">Cobrado</Th>
                <Th>Estado</Th>
                <Th>Creada</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statements.map((s) => {
                const currency = s.items[0]?.bookingItem.booking.currency ?? user.organization.defaultCurrency;
                const expected = s.items.reduce((acc, i) => acc + toNumber(i.expectedAmount), 0);
                const received = s.items
                  .filter((i) => i.bookingItem.commissionStatus === "PAID")
                  .reduce((acc, i) => acc + toNumber(i.bookingItem.commissionPaidAmount ?? i.expectedAmount), 0);
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/app/comisiones/planillas/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {s.agency?.name ?? "Sin agencia"}
                      </Link>
                    </Td>
                    <Td className="text-xs">
                      {formatDate(s.periodFrom)} – {formatDate(s.periodTo)}
                    </Td>
                    <Td className="text-right">{s.items.length}</Td>
                    <Td className="text-right">{money(expected, currency)}</Td>
                    <Td className="text-right text-emerald-700">{money(received, currency)}</Td>
                    <Td>
                      <Badge className={STATUS_COLOR[s.status]}>{STATEMENT_STATUS_LABEL[s.status]}</Badge>
                    </Td>
                    <Td className="text-xs">{formatDate(s.createdAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
