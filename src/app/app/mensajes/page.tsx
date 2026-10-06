import Link from "next/link";
import clsx from "clsx";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/ui";
import { Chat } from "@/components/chat";
import { formatDateTime } from "@/lib/format";
import { loadThread } from "@/lib/messages";
import { readThread, sendAgentMessage } from "./actions";

export const metadata = { title: "Mensajes" };

type Thread = {
  key: string;
  clientId: string;
  bookingId: string | null;
  clientName: string;
  bookingTitle: string | null;
  lastBody: string;
  lastAt: Date;
  unread: number;
};

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string; b?: string }> }) {
  const user = await requireUser();
  const { c, b } = await searchParams;

  // Último mensaje de cada hilo (cliente + reserva) de la organización.
  const recent = await db.message.findMany({
    where: { client: { organizationId: user.organizationId } },
    orderBy: { createdAt: "desc" },
    take: 2000,
    include: {
      client: { select: { firstName: true, lastName: true } },
      booking: { select: { title: true, code: true } },
    },
  });
  const threads = new Map<string, Thread>();
  for (const m of recent) {
    const key = `${m.clientId}:${m.bookingId ?? ""}`;
    let t = threads.get(key);
    if (!t) {
      t = {
        key,
        clientId: m.clientId,
        bookingId: m.bookingId,
        clientName: `${m.client.firstName} ${m.client.lastName}`,
        bookingTitle: m.booking ? `${m.booking.code} · ${m.booking.title}` : null,
        lastBody: m.body,
        lastAt: m.createdAt,
        unread: 0,
      };
      threads.set(key, t);
    }
    if (m.senderType === "CLIENT" && !m.readByAgentAt) t.unread++;
  }
  // Los no leídos primero, después por fecha.
  const list = [...threads.values()].sort((x, y) => (y.unread > 0 ? 1 : 0) - (x.unread > 0 ? 1 : 0) || y.lastAt.getTime() - x.lastAt.getTime());

  let selected: Thread | undefined;
  let initial = null;
  if (c) {
    const client = await db.client.findFirst({ where: { id: c, organizationId: user.organizationId } });
    if (client) {
      const bookingId = b || null;
      const booking = bookingId ? await db.booking.findFirst({ where: { id: bookingId, clientId: c } }) : null;
      selected = threads.get(`${c}:${b ?? ""}`) ?? {
        key: `${c}:${b ?? ""}`,
        clientId: c,
        bookingId,
        clientName: `${client.firstName} ${client.lastName}`,
        bookingTitle: booking ? `${booking.code} · ${booking.title}` : null,
        lastBody: "",
        lastAt: new Date(),
        unread: 0,
      };
      await db.message.updateMany({
        where: { clientId: c, bookingId, senderType: "CLIENT", readByAgentAt: null },
        data: { readByAgentAt: new Date() },
      });
      initial = await loadThread(c, bookingId);
    }
  }

  return (
    <>
      <PageHeader title="Mensajes" description="Conversaciones con tus clientes desde su portal. Los hilos sin leer aparecen primero." />
      {list.length === 0 && !selected ? (
        <EmptyState title="Todavía no hay mensajes" description="Cuando un cliente te escriba desde su portal, o vos le escribas desde un viaje, la conversación aparece acá." />
      ) : (
        <Card className="grid h-[70vh] overflow-hidden lg:grid-cols-[320px_1fr]">
          <ul className="divide-y divide-slate-100 overflow-y-auto border-r border-slate-200">
            {list.map((t) => (
              <li key={t.key}>
                <Link
                  href={`/app/mensajes?c=${t.clientId}${t.bookingId ? `&b=${t.bookingId}` : ""}`}
                  className={clsx("flex gap-3 px-4 py-3 hover:bg-slate-50", selected?.key === t.key && "bg-brand-50")}
                >
                  <Avatar name={t.clientName} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center justify-between gap-2 text-sm font-medium text-slate-900">
                      <span className="truncate">{t.clientName}</span>
                      {t.unread > 0 && <span className="rounded-full bg-fuchsia-500 px-1.5 text-[11px] text-white">{t.unread}</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{t.bookingTitle ?? "Conversación general"}</p>
                    <p className={clsx("truncate text-xs", t.unread ? "font-medium text-slate-800" : "text-slate-400")}>{t.lastBody}</p>
                    <p className="text-[11px] text-slate-400">{formatDateTime(t.lastAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {selected && initial ? (
            <div className="flex min-h-0 flex-col bg-slate-50">
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <Link href={`/app/clientes/${selected.clientId}`} className="font-medium text-slate-900 hover:text-brand-700">
                  {selected.clientName}
                </Link>
                {selected.bookingId && (
                  <Link href={`/app/viajes/${selected.bookingId}`} className="block text-xs text-slate-500 hover:text-brand-700">
                    {selected.bookingTitle}
                  </Link>
                )}
              </div>
              <Chat
                key={selected.key}
                className="min-h-0 flex-1"
                initial={initial}
                viewer="AGENT"
                send={sendAgentMessage.bind(null, selected.clientId, selected.bookingId)}
                poll={readThread.bind(null, selected.clientId, selected.bookingId)}
              />
            </div>
          ) : (
            <div className="hidden items-center justify-center text-sm text-slate-400 lg:flex">Elegí una conversación</div>
          )}
        </Card>
      )}
    </>
  );
}
