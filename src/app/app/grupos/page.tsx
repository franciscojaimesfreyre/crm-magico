import Link from "next/link";
import clsx from "clsx";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { DESTINATION_LABEL, GROUP_STATUSES, GROUP_STATUS_LABEL } from "@/lib/labels";
import { formatRange, money, toNumber } from "@/lib/format";
import type { GroupStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Grupos" };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const user = await requireUser();
  const { estado } = await searchParams;
  const groups = await db.group.findMany({
    where: { organizationId: user.organizationId, ...(estado ? { status: estado as GroupStatus } : {}) },
    include: { organizer: true, bookings: { select: { adults: true, children: true, totalPrice: true, currency: true, status: true } } },
    orderBy: { startDate: { sort: "asc", nulls: "last" } },
  });
  return (
    <>
      <PageHeader
        title="Grupos"
        description="Varias familias, celebraciones o grupos de crucero viajando juntos: sus viajes vinculados, un itinerario compartido y mensajes a todos."
        actions={<LinkButton href="/app/grupos/nuevo">Nuevo grupo</LinkButton>}
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ value: "", label: "Todos" }, ...GROUP_STATUSES].map((s) => (
          <Link
            key={s.value}
            href={s.value ? `/app/grupos?estado=${s.value}` : "/app/grupos"}
            className={clsx("rounded-full px-3 py-1 text-xs font-medium", (estado ?? "") === s.value ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}
          >
            {s.label}
          </Link>
        ))}
      </div>
      {groups.length === 0 ? (
        <EmptyState title="No hay grupos" action={<LinkButton href="/app/grupos/nuevo">Crear grupo</LinkButton>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const active = g.bookings.filter((b) => b.status !== "CANCELLED");
            const guests = active.reduce((s, b) => s + b.adults + b.children, 0);
            const revenue = active.reduce((s, b) => s + toNumber(b.totalPrice), 0);
            return (
              <Link key={g.id} href={`/app/grupos/${g.id}`}>
                <Card className="h-full p-5 hover:border-brand-200">
                  <p className="font-semibold text-slate-900">{g.name}</p>
                  <Badge className="mt-1 bg-brand-50 text-brand-700">{GROUP_STATUS_LABEL[g.status]}</Badge>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-400">Viaje</dt>
                      <dd>{formatRange(g.startDate, g.endDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Destino</dt>
                      <dd>{g.destination ? DESTINATION_LABEL[g.destination] : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Organizador</dt>
                      <dd>{g.organizer ? `${g.organizer.firstName} ${g.organizer.lastName}` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Viajes / viajeros</dt>
                      <dd>
                        {active.length} / {guests}
                      </dd>
                    </div>
                  </dl>
                  {revenue > 0 && <p className="mt-3 text-sm font-medium text-slate-700">{money(revenue, active[0]?.currency ?? "USD")}</p>}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
