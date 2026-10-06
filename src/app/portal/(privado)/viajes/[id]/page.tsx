import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { CalendarClock, Download, ExternalLink, FileText, Utensils } from "lucide-react";
import { db } from "@/lib/db";
import { requireClientAccount } from "@/lib/auth";
import { Chat } from "@/components/chat";
import { ItineraryView } from "@/components/itinerary-view";
import { DESTINATION_LABEL, ITEM_TYPE_LABEL } from "@/lib/labels";
import { ageOn, daysBetween, fileSize, formatDate, formatRange, money, todayUTC } from "@/lib/format";
import { computeKeyDates } from "@/lib/key-dates";
import { loadThread } from "@/lib/messages";
import { readClientThread, sendClientMessage } from "../../../actions";
import type { BookingStatus } from "@/generated/prisma/enums";

const CLIENT_STATUS: Record<BookingStatus, string> = {
  INQUIRY: "Estamos armando tu cotización",
  QUOTED: "Cotización enviada",
  BOOKED: "Reservado",
  PAID_IN_FULL: "Pagado",
  TRAVELED: "¡Viajaron!",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const TABS = [
  { key: "resumen", label: "Mi viaje" },
  { key: "itinerario", label: "Itinerario" },
  { key: "documentos", label: "Documentos" },
  { key: "mensajes", label: "Mensajes" },
];

export default async function PortalTrip({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "resumen" } = await searchParams;
  const account = await requireClientAccount();
  const b = await db.booking.findFirst({
    where: { id, clientId: account.clientId },
    include: {
      travelers: { include: { traveler: true } },
      items: { orderBy: { position: "asc" } },
      diningReservations: { orderBy: { dateTime: "asc" } },
      quotes: { where: { status: { in: ["SENT", "ACCEPTED"] } }, orderBy: { createdAt: "desc" } },
      group: true,
    },
  });
  if (!b) notFound();
  const today = todayUTC();
  const daysLeft = b.startDate ? daysBetween(today, b.startDate) : null;

  return (
    <div>
      <Link href="/portal" className="text-sm text-slate-500 hover:text-slate-800">
        ← Mis viajes
      </Link>
      <div className="mt-2 mb-4 rounded-3xl bg-gradient-to-br from-brand-800 to-fuchsia-700 p-5 text-white">
        <p className="text-xs tracking-wide text-white/70 uppercase">{CLIENT_STATUS[b.status]}</p>
        <h1 className="text-2xl font-semibold">{b.title}</h1>
        <p className="text-sm text-white/80">
          {DESTINATION_LABEL[b.destination]} · {formatRange(b.startDate, b.endDate)}
        </p>
        {daysLeft !== null && daysLeft > 0 && (
          <p className="mt-3 text-sm">
            <span className="text-3xl font-semibold">{daysLeft}</span> días para el viaje
          </p>
        )}
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-100">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/portal/viajes/${b.id}?tab=${t.key}`}
            className={clsx("flex-1 rounded-full px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap", tab === t.key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "resumen" && (
        <div className="space-y-4">
          {b.quotes.filter((q) => q.status === "SENT").map((q) => (
            <Link key={q.id} href={`/portal/cotizaciones/${q.id}`} className="block rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
              Tenés una cotización para revisar: <strong>{q.title}</strong> →
            </Link>
          ))}
          {b.clientNotes && <Section title="Notas de tu agente"><p className="text-sm whitespace-pre-line text-slate-700">{b.clientNotes}</p></Section>}

          <Section title="Fechas importantes">
            <ul className="space-y-2">
              {computeKeyDates(b).map((k) => {
                const diff = daysBetween(today, k.date);
                return (
                  <li key={k.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className={clsx("flex items-center gap-2", diff < 0 ? "text-slate-400" : "text-slate-800")}>
                      <CalendarClock className="size-4 text-brand-500" /> {k.label}
                    </span>
                    <span className="text-slate-500">{formatDate(k.date)}</span>
                  </li>
                );
              })}
            </ul>
          </Section>

          {b.items.some((i) => i.status !== "CANCELLED") && (
            <Section title="Tus reservas">
              <p className="mb-2 text-xs text-slate-400">Cada reserva se paga directamente a su proveedor con tu tarjeta.</p>
              <ul className="divide-y divide-slate-100 text-sm">
                {b.items
                  .filter((i) => i.status !== "CANCELLED")
                  .map((i) => (
                    <li key={i.id} className="py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-xs text-slate-400">
                            {ITEM_TYPE_LABEL[i.type]}
                            {i.supplier && ` · ${i.supplier}`}
                          </span>
                          <p className="text-slate-800">{i.description}</p>
                          <p className="text-xs text-slate-500">
                            {[
                              i.startDate && formatRange(i.startDate, i.endDate),
                              i.status === "CONFIRMED" ? (i.confirmationNumber ? `Confirmación ${i.confirmationNumber}` : "Confirmada") : "Tu agente la está confirmando",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        {Number(i.price) > 0 && <span className="whitespace-nowrap text-slate-700">{money(i.price, b.currency)}</span>}
                      </div>
                      {(i.depositAmount !== null || i.balanceDue || i.balancePaidAt) && (
                        <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
                          {i.depositAmount !== null && (
                            <span className={i.depositPaidAt ? "text-emerald-600" : "text-amber-600"}>
                              Depósito {money(i.depositAmount, b.currency)} {i.depositPaidAt ? "· pagado" : "· pendiente"}
                            </span>
                          )}
                          {i.balancePaidAt ? (
                            <span className="text-emerald-600">Saldo pagado</span>
                          ) : i.balanceDue ? (
                            <span className="text-slate-600">Saldo: vence el {formatDate(i.balanceDue)}</span>
                          ) : null}
                        </p>
                      )}
                    </li>
                  ))}
              </ul>
              {Number(b.totalPrice) > 0 && (
                <p className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm font-medium">
                  <span>Total del viaje</span>
                  <span>{money(b.totalPrice, b.currency)}</span>
                </p>
              )}
            </Section>
          )}

          {(b.resort || b.ticketType) && (
            <Section title="Hotel y entradas">
              <p className="text-sm text-slate-700">{[b.resort, b.roomType].filter(Boolean).join(" · ")}</p>
              <p className="text-sm text-slate-700">{[b.ticketType, b.parkDays && `${b.parkDays} días de parque`, b.lightningLane && "Lightning Lane", b.memoryMaker && "Memory Maker"].filter(Boolean).join(" · ")}</p>
            </Section>
          )}

          {b.diningReservations.length > 0 && (
            <Section title="Reservas de restaurantes">
              <ul className="space-y-2 text-sm">
                {b.diningReservations.map((d) => (
                  <li key={d.id} className="flex items-start gap-2">
                    <Utensils className="mt-0.5 size-4 text-amber-500" />
                    <div>
                      <p className="font-medium text-slate-800">{d.restaurant}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(d.dateTime)} · {d.dateTime.toISOString().slice(11, 16)} h
                        {d.confirmationNumber && ` · Conf. ${d.confirmationNumber}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Viajeros">
            <ul className="space-y-1 text-sm text-slate-700">
              {b.travelers.map(({ traveler: t }) => {
                const age = ageOn(t.birthDate, b.startDate ?? undefined);
                return (
                  <li key={t.id}>
                    {t.firstName} {t.lastName}
                    {age !== null && <span className="text-slate-400"> · {age} años</span>}
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>
      )}

      {tab === "itinerario" && <PortalItinerary bookingId={b.id} groupId={b.groupId} />}
      {tab === "documentos" && <PortalDocuments bookingId={b.id} />}
      {tab === "mensajes" && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <Chat
            className="h-[65vh] bg-[#faf8f5]"
            initial={await loadThread(account.clientId, b.id)}
            viewer="CLIENT"
            send={sendClientMessage.bind(null, b.id)}
            poll={readClientThread.bind(null, b.id)}
            placeholder="Escribile a tu agente…"
          />
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

async function PortalItinerary({ bookingId, groupId }: { bookingId: string; groupId: string | null }) {
  let days = await db.itineraryDay.findMany({
    where: { bookingId },
    orderBy: { dayNumber: "asc" },
    include: { items: { orderBy: { position: "asc" } } },
  });
  // Si el viaje es parte de un grupo y no tiene itinerario propio, se muestra el del grupo.
  if (days.length === 0 && groupId) {
    days = await db.itineraryDay.findMany({
      where: { groupId },
      orderBy: { dayNumber: "asc" },
      include: { items: { orderBy: { position: "asc" } } },
    });
  }
  if (days.length === 0) {
    return <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Tu agente todavía está armando el itinerario. ¡Te avisamos cuando esté listo!</p>;
  }
  return <ItineraryView days={days} />;
}

async function PortalDocuments({ bookingId }: { bookingId: string }) {
  const docs = await db.document.findMany({ where: { bookingId, visibleToClient: true }, orderBy: { createdAt: "desc" } });
  if (docs.length === 0) return <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Todavía no hay documentos.</p>;
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="size-5 shrink-0 text-brand-500" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{d.name}</p>
              <p className="text-xs text-slate-400">{[fileSize(d.size), formatDate(d.createdAt)].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          {d.storageKey ? (
            <div className="flex shrink-0 gap-3 text-sm">
              <a href={`/api/archivos/${d.id}`} target="_blank" className="text-brand-700 hover:underline">
                Ver
              </a>
              <a href={`/api/archivos/${d.id}?descargar=1`} className="text-slate-500 hover:text-slate-800" title="Descargar">
                <Download className="size-4" />
              </a>
            </div>
          ) : (
            <a href={d.url ?? "#"} target="_blank" className="shrink-0 text-sm text-brand-700 hover:underline">
              Abrir <ExternalLink className="inline size-3.5" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
