import "server-only";
import { db } from "@/lib/db";

export async function loadBooking(id: string, organizationId: string) {
  return db.booking.findFirst({
    where: { id, organizationId },
    include: {
      client: { include: { travelers: { orderBy: { createdAt: "asc" } }, account: true } },
      organization: { select: { agency: true } },
      group: true,
      travelers: { include: { traveler: true } },
      items: {
        orderBy: { position: "asc" },
        include: {
          payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] },
          travelers: { include: { traveler: { select: { firstName: true, lastName: true } } } },
          documents: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, storageKey: true, url: true } },
          // De qué cotización salió (vacío = cargada a mano).
          quoteItem: { select: { option: { select: { name: true, quote: { select: { id: true, title: true, _count: { select: { options: true } } } } } } } },
        },
      },
      flightLegs: true,
      quotes: {
        orderBy: { createdAt: "desc" },
        include: { options: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" }, include: { reservations: { select: { id: true, status: true, balancePaidAt: true, price: true } } } } } } },
      },
      _count: { select: { days: true, documents: true, messages: true, tasks: { where: { completedAt: null } } } },
    },
  });
}

export type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;
