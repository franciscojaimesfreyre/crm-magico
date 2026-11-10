import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireAgencyUser } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { STATEMENT_STATUS_LABEL } from "@/lib/labels";
import { formatDate, money, toNumber } from "@/lib/format";
import { receivedOf } from "@/lib/commissions";

export const metadata = { title: "Planillas de comisiones" };

/** Planillas que los agentes le mandaron a la agencia: qué falta pagar y a quién. */
export default async function AgencyStatements() {
  const user = await requireAgencyUser();
  const list = await db.commissionStatement.findMany({
    where: { agencyId: user.agencyId, sentAt: { not: null } },
    include: { organization: { select: { name: true } }, agent: { select: { name: true } }, items: { where: { cancelledAt: null }, include: { bookingItem: { include: { booking: { select: { currency: true } } } } } } },
    orderBy: { sentAt: "desc" },
  });
  return (
    <>
      <PageHeader title="Planillas de comisiones" description="Las que te mandaron tus agentes. Registrá cada transferencia y el agente lo ve al instante." />
      {list.length === 0 ? (
        <EmptyState title="Todavía no recibiste planillas" description="Cuando un agente te mande una planilla desde Yiorno, aparece acá." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {list.map((s) => {
              const currency = s.items[0]?.bookingItem.booking.currency ?? "USD";
              const expected = s.items.reduce((t, r) => t + toNumber(r.expectedAmount), 0);
              const received = s.items.reduce((t, r) => t + receivedOf(r.bookingItem, toNumber(r.expectedAmount)), 0);
              return (
                <li key={s.id}>
                  <Link href={`/agencia/planillas/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="font-medium text-slate-900">{s.agent?.name ?? s.organization.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(s.periodFrom)} al {formatDate(s.periodTo)} · {s.items.length} reservas · recibida el {formatDate(s.sentAt)}
                      </p>
                    </div>
                    <Badge className={s.status === "PAID" ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-900"}>{STATEMENT_STATUS_LABEL[s.status]}</Badge>
                    <span className="text-sm tabular-nums">
                      {money(received, currency)} de {money(expected, currency)}
                    </span>
                    <ChevronRight className="size-4 text-slate-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
