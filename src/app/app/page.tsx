import Link from "next/link";
import { CalendarClock, Plane, Plus, Share2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, CardHeader, LinkButton, StatCard } from "@/components/ui";
import { TaskList } from "@/components/task-list";
import { CopyText } from "@/app/app/clientes/[id]/client-widgets";
import { BOOKING_STATUS_COLOR, BOOKING_STATUS_LABEL, DESTINATION_LABEL } from "@/lib/labels";
import { addDays, daysBetween, formatDate, formatRange, money, todayUTC, toNumber } from "@/lib/format";
import { computeKeyDates } from "@/lib/key-dates";
import { runDateWorkflowsIfDue } from "@/lib/automations";

export const metadata = { title: "Inicio" };

export default async function Dashboard() {
  const user = await requireUser();
  const orgId = user.organizationId;
  await runDateWorkflowsIfDue(orgId);

  const today = todayUTC();
  const in7 = addDays(today, 7);
  const in90 = addDays(today, 90);
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const last30 = addDays(today, -30);
  const currency = user.organization.defaultCurrency;

  const [activeCount, inquiries, quotesSent, tasks, upcoming, sales30, salesYear, commissionToCollect, recentInquiries] = await Promise.all([
    db.booking.count({ where: { organizationId: orgId, status: { in: ["BOOKED", "PAID_IN_FULL"] } } }),
    db.booking.count({ where: { organizationId: orgId, status: "INQUIRY" } }),
    db.quote.count({ where: { booking: { organizationId: orgId }, status: "SENT" } }),
    db.task.findMany({
      where: { organizationId: orgId, completedAt: null, OR: [{ assigneeId: user.id }, { assigneeId: null }], dueDate: { lte: in7 } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 10,
      include: {
        booking: { select: { id: true, code: true, title: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    db.booking.findMany({
      where: { organizationId: orgId, status: { notIn: ["CANCELLED", "COMPLETED"] }, startDate: { gte: addDays(today, -60), lte: in90 } },
      include: { client: { select: { firstName: true, lastName: true } }, items: true },
      orderBy: { startDate: "asc" },
    }),
    // Ventas = reservas confirmadas con un proveedor (un viaje puede tener varias).
    db.bookingItem.aggregate({
      where: { status: "CONFIRMED", saleDate: { gte: last30 }, booking: { organizationId: orgId, status: { not: "CANCELLED" } } },
      _sum: { price: true, commissionAmount: true },
      _count: true,
    }),
    db.bookingItem.aggregate({
      where: { status: "CONFIRMED", saleDate: { gte: yearStart }, booking: { organizationId: orgId, status: { not: "CANCELLED" } } },
      _sum: { price: true, commissionAmount: true },
    }),
    db.bookingItem.aggregate({
      where: {
        status: "CONFIRMED",
        commissionStatus: { not: "PAID" },
        booking: { organizationId: orgId, status: { in: ["TRAVELED", "COMPLETED"] } },
      },
      _sum: { commissionAmount: true },
      _count: true,
    }),
    db.booking.findMany({
      where: { organizationId: orgId, status: "INQUIRY" },
      include: { client: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Fechas clave de los próximos 30 días de todos los viajes.
  const keyDates = upcoming
    .flatMap((b) => computeKeyDates(b).map((k) => ({ ...k, booking: b })))
    .filter((k) => k.date >= today && k.date <= addDays(today, 30) && k.kind !== "checkout")
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 10);
  const nextTrips = upcoming.filter((b) => b.startDate && b.startDate >= today).slice(0, 6);

  const hour = Number(new Intl.DateTimeFormat("es-AR", { hour: "numeric", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()));
  const greeting = hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const leadUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/cotizar/${user.organization.marketingCode}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-fuchsia-600 px-6 py-5 text-white">
        <div>
          <h1 className="text-2xl font-semibold">
            {greeting}, {user.name.split(" ")[0]} ✨
          </h1>
          <p className="text-sm text-white/80 first-letter:uppercase">
            {new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())}
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/app/viajes/nueva" variant="secondary" size="sm">
            <Plus className="size-4" /> Viaje
          </LinkButton>
          <LinkButton href="/app/clientes/nuevo" variant="secondary" size="sm">
            <Plus className="size-4" /> Cliente
          </LinkButton>
        </div>
      </div>

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Share2 className="size-5" />
          </span>
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Tu formulario de cotización</p>
            <p className="text-sm text-slate-800">
              Compartilo en redes, tu web o WhatsApp: <code className="text-xs">{leadUrl}</code>
            </p>
          </div>
        </div>
        <CopyText text={leadUrl} label="Copiar link" />
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ventas últimos 30 días" value={money(sales30._sum.price, currency)} hint={`${sales30._count} reservas · comisión ${money(sales30._sum.commissionAmount, currency)}`} />
        <StatCard label={`Comisión ${today.getUTCFullYear()}`} value={money(salesYear._sum.commissionAmount, currency)} tone="good" hint={`Vendido: ${money(salesYear._sum.price, currency)}`} />
        <StatCard
          label="Comisión por cobrar"
          value={money(commissionToCollect._sum.commissionAmount, currency)}
          tone={toNumber(commissionToCollect._sum.commissionAmount) > 0 ? "warn" : "default"}
          hint={
            <Link href="/app/comisiones" className="text-brand-700 hover:underline">
              {commissionToCollect._count} reservas de viajes realizados sin cobrar →
            </Link>
          }
        />
        <StatCard label="Pipeline" value={`${inquiries} / ${quotesSent} / ${activeCount}`} hint="Consultas / cotizaciones enviadas / viajes reservados" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tareas de esta semana" actions={<Link href="/app/tareas" className="text-xs text-brand-700 hover:underline">Ver todas</Link>} />
          <TaskList tasks={tasks} />
        </Card>

        <Card>
          <CardHeader title="Fechas clave (30 días)" description="Restaurantes, Lightning Lane, pagos y salidas" />
          {keyDates.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Nada en los próximos 30 días.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {keyDates.map((k, i) => {
                const diff = daysBetween(today, k.date);
                return (
                  <li key={i} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <CalendarClock className="size-4 shrink-0 text-brand-500" />
                      <div className="min-w-0">
                        <p className="truncate text-slate-800">{k.label}</p>
                        <Link href={`/app/viajes/${k.booking.id}`} className="truncate text-xs text-slate-500 hover:text-brand-700">
                          {k.booking.client.firstName} {k.booking.client.lastName} · {k.booking.title}
                        </Link>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-slate-700">{formatDate(k.date)}</p>
                      <p className={diff <= 3 ? "text-xs font-medium text-rose-600" : "text-xs text-slate-500"}>{diff === 0 ? "hoy" : `en ${diff} días`}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Próximos viajes" />
          {nextTrips.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No hay viajes en los próximos 90 días.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {nextTrips.map((b) => (
                <li key={b.id}>
                  <Link href={`/app/viajes/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <Plane className="size-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {b.client.firstName} {b.client.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {DESTINATION_LABEL[b.destination]} · {formatRange(b.startDate, b.endDate)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand-700">{daysBetween(today, b.startDate!)} días</p>
                      <Badge className={BOOKING_STATUS_COLOR[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Consultas nuevas" actions={<Link href="/app/viajes?estado=INQUIRY" className="text-xs text-brand-700 hover:underline">Ver todas</Link>} />
          {recentInquiries.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Sin consultas pendientes.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentInquiries.map((b) => (
                <li key={b.id}>
                  <Link href={`/app/viajes/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {b.client.firstName} {b.client.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {DESTINATION_LABEL[b.destination]} · {formatRange(b.startDate, b.endDate)}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">{formatDate(b.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
