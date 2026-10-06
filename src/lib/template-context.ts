import "server-only";
import { db } from "@/lib/db";
import { BOOKING_STATUS_LABEL, DESTINATION_LABEL } from "@/lib/labels";
import { formatDate, formatRange, fullName, money } from "@/lib/format";
import type { TemplateVars } from "@/lib/templating";
import { appUrl } from "@/lib/app-url";

/**
 * Arma las variables de plantilla para un cliente y, opcionalmente, un viaje y una de sus reservas
 * (por ejemplo, la que tiene un saldo por vencer).
 */
export async function buildTemplateVars(opts: {
  clientId: string;
  bookingId?: string | null;
  bookingItemId?: string | null;
  agentName?: string | null;
}): Promise<TemplateVars> {
  const client = await db.client.findUniqueOrThrow({
    where: { id: opts.clientId },
    include: { organization: true, owner: true },
  });
  const baseUrl = appUrl();
  const vars: TemplateVars = {
    clientName: client.firstName,
    clientFullName: fullName(client),
    agentName: opts.agentName ?? client.owner?.name ?? client.organization.name,
    agencyName: client.organization.name,
    portalLink: `${baseUrl}/portal`,
    today: formatDate(new Date()),
  };
  if (opts.bookingId) {
    const b = await db.booking.findUnique({
      where: { id: opts.bookingId },
      include: { travelers: { include: { traveler: true } }, items: { orderBy: { position: "asc" } } },
    });
    if (b) {
      const active = b.items.filter((i) => i.status !== "CANCELLED");
      const unpaid = active
        .filter((i) => i.balanceDue && !i.balancePaidAt)
        .sort((x, y) => x.balanceDue!.getTime() - y.balanceDue!.getTime());
      const current = opts.bookingItemId ? b.items.find((i) => i.id === opts.bookingItemId) : undefined;
      Object.assign(vars, {
        tripTitle: b.title,
        destination: DESTINATION_LABEL[b.destination],
        tripDates: formatRange(b.startDate, b.endDate),
        startDate: formatDate(b.startDate),
        endDate: formatDate(b.endDate),
        resortName: b.resort ?? "",
        bookingCode: b.code,
        bookingStatus: BOOKING_STATUS_LABEL[b.status],
        totalPrice: money(b.totalPrice, b.currency),
        reservations: active
          .map((i) => `- ${i.description}${i.supplier ? ` (${i.supplier})` : ""}${i.confirmationNumber ? ` · confirmación ${i.confirmationNumber}` : ""}`)
          .join("\n"),
        pendingPayments: unpaid.map((i) => `- ${i.description}${i.supplier ? ` (${i.supplier})` : ""}: vence el ${formatDate(i.balanceDue)}`).join("\n"),
        reservation: current ? `${current.description}${current.supplier ? ` (${current.supplier})` : ""}` : "",
        finalPaymentDue: formatDate((current ?? unpaid[0])?.balanceDue),
        travelers: b.travelers.map((t) => fullName(t.traveler)).join(", "),
        portalLink: `${baseUrl}/portal/viajes/${b.id}`,
      } satisfies TemplateVars);
    }
  }
  return vars;
}
