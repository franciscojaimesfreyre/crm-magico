import Link from "next/link";
import { CalendarDays, ChevronRight, FileText, MessageCircle, Plus, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { requireClientAccount } from "@/lib/auth";
import { Avatar, buttonClass } from "@/components/ui";
import { DESTINATION_LABEL } from "@/lib/labels";
import { daysBetween, formatRange, todayUTC } from "@/lib/format";
import { mainStay } from "@/lib/trips";

export const metadata = { title: "Mis viajes" };

export default async function PortalHome() {
  const account = await requireClientAccount();
  const client = account.client;
  const today = todayUTC();
  const [bookings, pendingQuotes] = await Promise.all([
    db.booking.findMany({
      where: { clientId: client.id, status: { not: "CANCELLED" } },
      include: { items: { select: { type: true, status: true, description: true }, orderBy: { position: "asc" } } },
      orderBy: { startDate: { sort: "asc", nulls: "last" } },
    }),
    db.quote.findMany({
      where: { booking: { clientId: client.id }, status: "SENT" },
      include: { booking: true },
      orderBy: { sentAt: "desc" },
    }),
  ]);
  const upcoming = bookings.filter((b) => !b.endDate || b.endDate >= today);
  const past = bookings.filter((b) => b.endDate && b.endDate < today);
  const next = upcoming.find((b) => b.startDate && ["BOOKED", "PAID_IN_FULL", "TRAVELED"].includes(b.status)) ?? upcoming[0];
  const daysLeft = next?.startDate ? daysBetween(today, next.startDate) : null;
  const agent = client.owner;

  return (
    <div className="space-y-6">
      {pendingQuotes.map((q) => (
        <Link
          key={q.id}
          href={`/portal/cotizaciones/${q.id}`}
          className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 p-4 text-white shadow-sm"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/25">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Tenés una cotización nueva</p>
            <p className="truncate text-sm text-white/90">
              {q.title} · {DESTINATION_LABEL[q.booking.destination]}
            </p>
          </div>
          <ChevronRight className="size-5" />
        </Link>
      ))}

      {next ? (
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-700 to-fuchsia-700 p-6 text-white shadow-lg">
          <p className="text-sm text-white/80">
            {daysLeft !== null && daysLeft > 0 && daysLeft <= 7
              ? `¡Ya casi, ${client.firstName}! Tu viaje empieza muy pronto`
              : daysLeft !== null && daysLeft <= 0
                ? `¡Que lo disfrutes, ${client.firstName}!`
                : `Hola ${client.firstName}, tu próximo viaje`}
          </p>
          <h1 className="mt-1 text-3xl leading-tight font-semibold">{next.title}</h1>
          <p className="mt-2 text-white/80">
            {formatRange(next.startDate, next.endDate)} · {next.adults} adultos{next.children ? `, ${next.children} menores` : ""}
            {mainStay(next.items) && ` · ${mainStay(next.items)}`}
          </p>
          {daysLeft !== null && daysLeft > 0 && (
            <p className="mt-6 flex items-baseline gap-3">
              <span className="text-6xl font-semibold">{daysLeft}</span>
              <span className="text-lg text-white/80">{daysLeft === 1 ? "día para el viaje" : "días para el viaje"}</span>
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/portal/viajes/${next.id}?tab=itinerario`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-800">
              <CalendarDays className="size-4" /> Ver itinerario
            </Link>
            <Link href={`/portal/viajes/${next.id}?tab=mensajes`} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/30">
              <MessageCircle className="size-4" /> Escribirle a {agent?.name.split(" ")[0] ?? "tu agente"}
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <Sparkles className="mx-auto size-8 text-brand-500" />
          <h1 className="mt-3 text-xl font-semibold text-slate-900">¿Empezamos a planear tu próximo viaje?</h1>
          <p className="mt-1 text-sm text-slate-500">Contanos qué tenés en mente y te armamos una cotización a medida.</p>
          <Link href="/portal/solicitar" className={buttonClass("primary", "md", "mt-4")}>
            Pedir una cotización
          </Link>
        </section>
      )}

      {upcoming.length > (next ? 1 : 0) && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Próximos viajes</h2>
          <TripList trips={upcoming.filter((b) => b.id !== next?.id)} />
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/portal/solicitar" className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 hover:ring-brand-200">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Plus className="size-5" />
          </span>
          <div>
            <p className="font-medium text-slate-900">Pedir otro viaje</p>
            <p className="text-xs text-slate-500">Te preparamos una cotización</p>
          </div>
        </Link>
        <Link href="/portal/perfil" className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 hover:ring-brand-200">
          <span className="flex size-10 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-700">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="font-medium text-slate-900">Tu familia y gustos</p>
            <p className="text-xs text-slate-500">Para planificar a tu medida</p>
          </div>
        </Link>
      </div>

      {agent && (
        <section className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <Avatar name={agent.name} className="size-12 text-base" />
          <div className="flex-1">
            <p className="text-xs text-slate-500">Tu agente de viajes</p>
            <p className="font-medium text-slate-900">{agent.name}</p>
            {client.organization.tagline && <p className="text-xs text-slate-500">{client.organization.tagline}</p>}
          </div>
          <Link href="/portal/mensajes" className={buttonClass("secondary", "sm")}>
            Mensaje
          </Link>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Viajes anteriores</h2>
          <TripList trips={past.reverse()} />
        </section>
      )}
    </div>
  );
}

function TripList({ trips }: { trips: { id: string; title: string; destination: keyof typeof DESTINATION_LABEL; startDate: Date | null; endDate: Date | null }[] }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      {trips.map((t) => (
        <li key={t.id}>
          <Link href={`/portal/viajes/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
            <div>
              <p className="font-medium text-slate-900">{t.title}</p>
              <p className="text-xs text-slate-500">
                {DESTINATION_LABEL[t.destination]} · {formatRange(t.startDate, t.endDate)}
              </p>
            </div>
            <ChevronRight className="size-4 text-slate-400" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
