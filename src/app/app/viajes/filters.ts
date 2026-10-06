import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus, Destination } from "@/generated/prisma/enums";
import { parseDateInput } from "@/lib/format";

export type BookingFilters = {
  q?: string;
  estado?: string;
  destino?: string;
  desde?: string;
  hasta?: string;
};

/** Traduce los filtros de la URL a un where de Prisma (lo usan la página y el export CSV). */
export function bookingWhere(organizationId: string, f: BookingFilters): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = { organizationId };
  if (f.estado) where.status = f.estado as BookingStatus;
  if (f.destino) where.destination = f.destino as Destination;
  const from = parseDateInput(f.desde);
  const to = parseDateInput(f.hasta);
  if (from || to) where.startDate = { ...(from && { gte: from }), ...(to && { lte: to }) };
  if (f.q) {
    where.OR = [
      { title: { contains: f.q, mode: "insensitive" } },
      { code: { contains: f.q, mode: "insensitive" } },
      { client: { firstName: { contains: f.q, mode: "insensitive" } } },
      { client: { lastName: { contains: f.q, mode: "insensitive" } } },
      { items: { some: { confirmationNumber: { contains: f.q, mode: "insensitive" } } } },
    ];
  }
  return where;
}
