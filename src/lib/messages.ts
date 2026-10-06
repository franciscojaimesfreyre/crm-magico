import "server-only";
import { db } from "@/lib/db";
import type { ChatMessage } from "@/components/chat";
import { formatDateTime } from "@/lib/format";

/** Mensajes de un hilo (cliente + reserva, o conversación general si bookingId es null). */
export async function loadThread(clientId: string, bookingId: string | null): Promise<ChatMessage[]> {
  const messages = await db.message.findMany({
    where: { clientId, bookingId },
    orderBy: { createdAt: "asc" },
    include: { senderUser: { select: { name: true } }, client: { select: { firstName: true, lastName: true } } },
    take: 500,
  });
  return messages.map((m) => ({
    id: m.id,
    body: m.body,
    senderType: m.senderType,
    senderName:
      m.senderType === "CLIENT"
        ? `${m.client.firstName} ${m.client.lastName}`
        : m.senderType === "AGENT"
          ? (m.senderUser?.name ?? "Agente")
          : "Sistema",
    createdAt: m.createdAt.toISOString(),
    timeLabel: formatDateTime(m.createdAt),
  }));
}
