import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { csvResponse, toCSV } from "@/lib/csv";
import { BOOKING_STATUS_LABEL, COMMISSION_STATUS_LABEL, DESTINATION_LABEL, ITEM_TYPE_LABEL, RESERVATION_STATUS_LABEL } from "@/lib/labels";
import { toNumber } from "@/lib/format";
import { bookingWhere } from "../filters";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const filters = Object.fromEntries(request.nextUrl.searchParams);
  const bookings = await db.booking.findMany({
    where: bookingWhere(user.organizationId, filters),
    include: { client: true, items: { orderBy: { position: "asc" } } },
    orderBy: { startDate: "asc" },
  });
  const amount = (v: unknown) => (v === null || v === undefined ? "" : toNumber(v as number).toFixed(2).replace(".", ","));
  // Una fila por reserva (paquete, tickets, auto…); los viajes sin reservas salen en una sola fila.
  const rows = bookings.flatMap((b) => {
    const trip = [
      b.code,
      `${b.client.firstName} ${b.client.lastName}`,
      b.client.email,
      b.title,
      DESTINATION_LABEL[b.destination],
      BOOKING_STATUS_LABEL[b.status],
      b.startDate,
      b.endDate,
      b.adults,
      b.children,
      b.currency,
    ];
    if (b.items.length === 0) return [[...trip, "", "", "", "", "", "", "", "", "", "", "", "", ""]];
    return b.items.map((i) => [
      ...trip,
      ITEM_TYPE_LABEL[i.type],
      i.description,
      i.supplier,
      i.confirmationNumber,
      RESERVATION_STATUS_LABEL[i.status],
      i.startDate,
      i.endDate,
      amount(i.price),
      i.balanceDue,
      i.balancePaidAt,
      i.saleDate,
      amount(i.commissionAmount),
      COMMISSION_STATUS_LABEL[i.commissionStatus],
    ]);
  });
  const csv = toCSV(
    [
      "Viaje", "Cliente", "Email", "Título", "Destino", "Estado del viaje", "Desde", "Hasta", "Adultos", "Menores", "Moneda",
      "Tipo de reserva", "Reserva", "Proveedor", "Confirmación", "Estado de la reserva", "Reserva desde", "Reserva hasta",
      "Importe", "Vence el saldo", "Saldo pagado el", "Fecha de venta", "Comisión", "Estado comisión",
    ],
    rows,
  );
  return csvResponse(`viajes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
