import Link from "next/link";
import { db } from "@/lib/db";
import { requireClientAccount } from "@/lib/auth";
import { Chat } from "@/components/chat";
import { loadThread } from "@/lib/messages";
import { readClientThread, sendClientMessage } from "../../actions";

export const metadata = { title: "Mensajes" };

export default async function PortalMessages() {
  const account = await requireClientAccount();
  const trips = await db.booking.findMany({
    where: { clientId: account.clientId, status: { not: "CANCELLED" } },
    include: {
      _count: { select: { messages: { where: { senderType: { not: "CLIENT" }, readByClientAt: null } } } },
    },
    orderBy: { startDate: { sort: "desc", nulls: "first" } },
  });
  const agentName = account.client.owner?.name ?? account.client.organization.name;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Mensajes</h1>
      {trips.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="mb-2 text-sm font-medium text-slate-700">Conversaciones por viaje</p>
          <ul className="space-y-1">
            {trips.map((t) => (
              <li key={t.id}>
                <Link href={`/portal/viajes/${t.id}?tab=mensajes`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className="text-slate-800">{t.title}</span>
                  {t._count.messages > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-xs text-white">{t._count.messages}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <p className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">Consulta general con {agentName}</p>
        <Chat
          className="h-[55vh] bg-[#faf8f5]"
          initial={await loadThread(account.clientId, null)}
          viewer="CLIENT"
          send={sendClientMessage.bind(null, null)}
          poll={readClientThread.bind(null, null)}
          placeholder="Escribile a tu agente…"
        />
      </div>
    </div>
  );
}
