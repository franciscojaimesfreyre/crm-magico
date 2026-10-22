import Link from "next/link";
import { after } from "next/server";
import clsx from "clsx";
import { AlertTriangle, CalendarClock, Inbox, Plus, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Avatar, Badge, Card, CardHeader, LinkButton, StatCard, StatStrip } from "@/components/ui";
import { TripTicket } from "@/components/trip-ticket";
import { TaskList } from "@/components/task-list";
import { CopyText } from "@/app/app/clientes/[id]/client-widgets";
import { BOOKING_STATUS_COLOR, BOOKING_STATUS_LABEL, DESTINATION_LABEL, DESTINATION_TONE, urgencyTone } from "@/lib/labels";
import { addDays, daysBetween, formatDate, formatRange, money, todayUTC, toNumber } from "@/lib/format";
import { computeKeyDates } from "@/lib/key-dates";
import { runDateWorkflowsIfDue } from "@/lib/automations";
import { syncThemeParksIfDue } from "@/lib/themeparks-sync";
import { appUrl } from "@/lib/app-url";
import { knowledgeHighlights } from "@/lib/knowledge-alerts";
import { KnowledgeHighlights } from "./knowledge-highlights";

export const metadata = { title: "Inicio" };

export default async function Dashboard() {
  const user = await requireUser();
  const orgId = user.organizationId;
  // Las automatizaciones nunca deben impedir que cargue el inicio.
  try {
    await runDateWorkflowsIfDue(orgId);
  } catch (e) {
    console.error("Error ejecutando automatizaciones", e);
  }
  // Horarios de los parques y catálogo: después de responder, para no demorar el inicio.
  after(() => syncThemeParksIfDue().catch((e) => console.error("Error sincronizando con ThemeParks.wiki", e)));

  const today = todayUTC();
  const in7 = addDays(today, 7);
  const in90 = addDays(today, 90);
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const last30 = addDays(today, -30);
  const currency = user.organization.defaultCurrency;

  const [activeCount, inquiries, quotesSent, tasks, upcoming, sales30, salesYear, commissionToCollect, recentInquiries, news] = await Promise.all([
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
      include: { client: { select: { firstName: true, lastName: true } }, items: true, flightLegs: true },
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
    knowledgeHighlights(orgId),
  ]);

  // Fechas clave de los próximos 30 días de todos los viajes.
  const allKeyDates = upcoming
    .flatMap((b) => computeKeyDates(b).map((k) => ({ ...k, booking: b })))
    .filter((k) => k.date >= today && k.date <= addDays(today, 30) && !["checkout", "stay-out", "dropoff"].includes(k.kind))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const keyDates = allKeyDates.slice(0, 10);
  // Saldos que los clientes tienen que pagar a sus proveedores en los próximos 30 días.
  const balancesDue = allKeyDates.filter((k) => k.kind === "payment");
  const nextTrips = upcoming.filter((b) => b.startDate && b.startDate >= today).slice(0, 6);

  const hour = Number(new Intl.DateTimeFormat("es-AR", { hour: "numeric", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()));
  const greeting = hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const leadUrl = `${appUrl()}/cotizar/${user.organization.marketingCode}`;
  const todayLabel = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

  // Lo que vence o pasa en los próximos 7 días y las tareas atrasadas (la fila "Necesita tu atención").
  const thisWeek = allKeyDates.filter((k) => k.date <= in7).length;
  const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < today).length;
  const toCollect = toNumber(commissionToCollect._sum.commissionAmount);

  const featured = nextTrips[0];
  const featuredNext = featured ? keyDates.find((k) => k.booking.id === featured.id) : undefined;
  const ticketOf = (b: (typeof nextTrips)[number], size: "sm" | "md") => (
    <TripTicket
      key={b.id}
      href={`/app/viajes/${b.id}`}
      code={b.code}
      title={b.title}
      client={`${b.client.firstName} ${b.client.lastName}`}
      destination={DESTINATION_LABEL[b.destination]}
      tone={DESTINATION_TONE[b.destination]}
      dates={formatRange(b.startDate, b.endDate)}
      status={size === "md" ? { label: BOOKING_STATUS_LABEL[b.status], className: BOOKING_STATUS_COLOR[b.status] } : undefined}
      daysToGo={b.startDate ? daysBetween(today, b.startDate) : null}
      next={size === "md" && featuredNext ? <>Próxima fecha clave: <strong className="font-semibold">{featuredNext.label}</strong> · {formatDate(featuredNext.date, { year: undefined })}</> : undefined}
      size={size}
      animate={size === "md"}
      cut="var(--sheet)"
    />
  );

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight text-slate-900">Inicio</h1>
          <p className="mt-1 text-[15px] text-[var(--ink-soft)]">
            {greeting}, {user.name.split(" ")[0]}. Hoy es {todayLabel}.
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/app/clientes/nuevo" variant="secondary">
            <Plus className="size-4" /> Cliente
          </LinkButton>
          <LinkButton href="/app/viajes/nueva">
            <Plus className="size-4" /> Nuevo viaje
          </LinkButton>
        </div>
      </div>

      {/* Lo primero que se lee: lo que necesita atención, en color según la urgencia. */}
      <section aria-label="Necesita tu atención" className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Attention
          href="/app/tareas"
          tone="rose"
          icon={AlertTriangle}
          count={overdueTasks}
          label={overdueTasks === 1 ? "tarea atrasada" : "tareas atrasadas"}
          zero="Sin tareas atrasadas"
        />
        <Attention href="/app/calendario" tone="amber" icon={CalendarClock} count={thisWeek} label={thisWeek === 1 ? "fecha clave esta semana" : "fechas clave esta semana"} zero="Nada en los próximos 7 días" />
        <Attention
          href="/app/calendario"
          tone="sky"
          icon={Wallet}
          count={balancesDue.length}
          label={balancesDue.length === 1 ? "saldo de cliente vence en 30 días" : "saldos de clientes vencen en 30 días"}
          zero="Sin saldos por vencer"
        />
        <Attention href="/app/viajes?estado=INQUIRY" tone="brand" icon={Inbox} count={inquiries} label={inquiries === 1 ? "consulta nueva para cotizar" : "consultas nuevas para cotizar"} zero="Sin consultas pendientes" />
      </section>

      <h2 className="mb-3 text-[13px] font-semibold tracking-[0.06em] text-[var(--ink-soft)] uppercase">Tu negocio</h2>
      <StatStrip className="mb-8">
        <StatCard label="Ventas · últimos 30 días" value={money(sales30._sum.price, currency)} hint={`${sales30._count} ${sales30._count === 1 ? "reserva confirmada" : "reservas confirmadas"} · comisión ${money(sales30._sum.commissionAmount, currency)}`} />
        <StatCard label={`Comisión ${today.getUTCFullYear()}`} value={money(salesYear._sum.commissionAmount, currency)} hint={`Sobre ${money(salesYear._sum.price, currency)} vendidos`} />
        <StatCard
          label="Comisión por cobrar"
          value={money(toCollect, currency)}
          hint={
            <Link href="/app/comisiones" className="font-semibold text-brand-700 hover:underline">
              {commissionToCollect._count} {commissionToCollect._count === 1 ? "reserva de viaje realizado" : "reservas de viajes realizados"} →
            </Link>
          }
        />
        <StatCard
          label="Viajes en curso"
          value={String(activeCount)}
          hint={
            <Link href="/app/viajes" className="hover:text-slate-900">
              {inquiries} {inquiries === 1 ? "consulta" : "consultas"} · {quotesSent} {quotesSent === 1 ? "cotización enviada" : "cotizaciones enviadas"}
            </Link>
          }
        />
      </StatStrip>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Fechas clave"
              description="Los próximos 30 días de tus viajes: restaurantes, Lightning Lane, saldos y salidas."
              actions={
                <LinkButton href="/app/calendario" variant="secondary" size="sm">
                  Calendario
                </LinkButton>
              }
            />
            {keyDates.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[var(--ink-soft)]">Nada en los próximos 30 días. Las fechas se calculan solas a partir de las reservas de cada viaje.</p>
            ) : (
              <ul className="space-y-1 p-2">
                {keyDates.map((k, i) => {
                  const diff = daysBetween(today, k.date);
                  const who = `${k.booking.client.firstName} ${k.booking.client.lastName}`;
                  return (
                    <li key={i}>
                      <Link href={`/app/viajes/${k.booking.id}`} className="flex items-center gap-4 rounded-xl px-3 py-2.5 hover:bg-[var(--raised)]">
                        <span className={clsx("flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5", urgencyTone(diff).soft, urgencyTone(diff).ink)}>
                          <span className="text-[11px] font-semibold tracking-[0.06em] uppercase opacity-80">{formatDate(k.date, { month: "short", day: undefined, year: undefined }).replace(".", "")}</span>
                          <span className="figure text-xl leading-none">{k.date.getUTCDate()}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{k.label}</p>
                          <p className="truncate text-[13px] text-[var(--ink-soft)]">
                            {who} · {k.booking.title}
                          </p>
                        </div>
                        <Badge className={clsx(urgencyTone(diff).soft, urgencyTone(diff).ink)}>{urgencyTone(diff).label}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Tareas de esta semana"
              description={overdueTasks > 0 ? `${overdueTasks} ${overdueTasks === 1 ? "atrasada" : "atrasadas"} y las que vencen en 7 días` : "Las que vencen en los próximos 7 días"}
              actions={
                <LinkButton href="/app/tareas" variant="secondary" size="sm">
                  Ver todas
                </LinkButton>
              }
            />
            <TaskList tasks={tasks} />
          </Card>

          <KnowledgeHighlights {...news} />
        </div>

        <aside className="order-first min-w-0 space-y-6 xl:order-none">
          <section>
            <h2 className="mb-2 text-base text-slate-900">Tu próximo viaje</h2>
            {featured ? ticketOf(featured, "md") : <p className="text-sm text-[var(--ink-soft)]">No hay viajes en los próximos 90 días.</p>}
            {nextTrips.length > 1 && <div className="mt-3 space-y-3">{nextTrips.slice(1).map((b) => ticketOf(b, "sm"))}</div>}
          </section>

          <Card>
            <CardHeader
              title="Consultas nuevas"
              actions={
                <LinkButton href="/app/viajes?estado=INQUIRY" variant="secondary" size="sm">
                  Ver todas
                </LinkButton>
              }
            />
            {recentInquiries.length === 0 ? (
              <p className="p-5 text-sm text-[var(--ink-soft)]">Sin consultas pendientes.</p>
            ) : (
              <ul className="space-y-1 p-2">
                {recentInquiries.map((b) => {
                  const who = `${b.client.firstName} ${b.client.lastName}`;
                  return (
                    <li key={b.id}>
                      <Link href={`/app/viajes/${b.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--raised)]">
                        <Avatar name={who} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{who}</p>
                          <p className="truncate text-[13px] text-[var(--ink-soft)]">
                            {DESTINATION_LABEL[b.destination]} · {b.startDate ? formatRange(b.startDate, b.endDate) : "Fechas a definir"}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-base text-slate-900">Tu formulario de cotización</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Compartilo en redes, tu web o WhatsApp: cada consulta entra como cliente nuevo.</p>
            <p className="mt-3 truncate rounded-xl bg-[var(--raised)] px-3 py-2 text-[13px] text-slate-800">{leadUrl.replace(/^https?:\/\//, "")}</p>
            <div className="mt-3">
              <CopyText text={leadUrl} label="Copiar link" />
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}

// Cada pendiente con su color: una franja pintada arriba, la cifra grande en la tinta del color.
const ATTENTION_TONE = {
  rose: { box: "bg-rose-50 ring-rose-100", num: "text-rose-700", bar: "bg-rose-500" },
  amber: { box: "bg-amber-50 ring-amber-100", num: "text-amber-800", bar: "bg-amber-400" },
  sky: { box: "bg-sky-50 ring-sky-100", num: "text-sky-800", bar: "bg-sky-500" },
  brand: { box: "bg-brand-50 ring-brand-100", num: "text-brand-700", bar: "bg-brand-500" },
} as const;

/** Un pendiente: cuántos hay, en el color de su urgencia; sin pendientes queda neutro. */
function Attention({
  href,
  tone,
  icon: Icon,
  count,
  label,
  zero,
}: {
  href: string;
  tone: keyof typeof ATTENTION_TONE;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  label: string;
  zero: string;
}) {
  const t = ATTENTION_TONE[tone];
  const active = count > 0;
  return (
    <Link
      href={href}
      className={clsx("t-lift relative flex min-w-0 flex-col overflow-hidden rounded-2xl px-4 pt-5 pb-4 ring-1", active ? t.box : "bg-white ring-[var(--border)]")}
    >
      {active && <span aria-hidden className={clsx("absolute inset-x-0 top-0 h-1", t.bar)} />}
      {active ? (
        <>
          <span className="flex items-center justify-between gap-2">
            <span className={clsx("figure text-[32px] leading-none", t.num)}>{count}</span>
            <Icon className={clsx("size-5 shrink-0", t.num)} />
          </span>
          <span className="mt-2 text-[13px] leading-snug font-medium text-slate-800">{label}</span>
        </>
      ) : (
        <span className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <Icon className="size-4 shrink-0" />
          {zero}
        </span>
      )}
    </Link>
  );
}
