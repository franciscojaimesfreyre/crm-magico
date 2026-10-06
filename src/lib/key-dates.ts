// Fechas clave de un viaje calculadas a partir de sus fechas y sus reservas. Función pura (cliente y servidor).
import type { Destination } from "@/generated/prisma/enums";
import { addDays } from "@/lib/format";

export type KeyDate = {
  date: Date;
  label: string;
  kind: "dining" | "lightning" | "payment" | "deposit" | "checkin" | "checkout" | "checkin-online";
  hint?: string;
};

// Ventanas configurables: si Disney o Universal las cambian, se ajustan acá.
export const DINING_WINDOW_DAYS = 60;
export const LIGHTNING_LANE_ONSITE_DAYS = 7;
export const CRUISE_ONLINE_CHECKIN_DAYS = 30;

const DISNEY_PARKS: Destination[] = ["DISNEY_WORLD", "DISNEYLAND"];

type ReservationInput = {
  type: string;
  description: string;
  supplier: string | null;
  status: string;
  startDate: Date | null;
  balanceDue: Date | null;
  balancePaidAt: Date | null;
};

type Input = {
  destination: Destination;
  startDate: Date | null;
  endDate: Date | null;
  items?: ReservationInput[];
};

/** Check-in en Disney: el de la reserva de hotel o paquete de Disney si existe, si no el inicio del viaje. */
function disneyCheckIn(b: Input) {
  const disneyStay = b.items?.find(
    (i) => i.status !== "CANCELLED" && (i.type === "PACKAGE" || i.type === "HOTEL") && /disney/i.test(`${i.supplier ?? ""} ${i.description}`) && i.startDate,
  );
  return disneyStay?.startDate ?? b.startDate;
}

export function computeKeyDates(b: Input): KeyDate[] {
  const out: KeyDate[] = [];
  const disney = disneyCheckIn(b);
  if (disney && (DISNEY_PARKS.includes(b.destination) || b.destination === "COMBINED")) {
    out.push({
      date: addDays(disney, -DINING_WINDOW_DAYS),
      label: "Abren las reservas de restaurantes",
      kind: "dining",
      hint: `${DINING_WINDOW_DAYS} días antes del check-in en Disney`,
    });
    out.push({
      date: addDays(disney, -LIGHTNING_LANE_ONSITE_DAYS),
      label: "Abre la reserva de Lightning Lane",
      kind: "lightning",
      hint: `${LIGHTNING_LANE_ONSITE_DAYS} días antes de la llegada (huéspedes de hoteles Disney)`,
    });
  }
  if (b.startDate) {
    if (b.destination === "DISNEY_CRUISE" || b.destination === "OTHER_CRUISE") {
      out.push({
        date: addDays(b.startDate, -CRUISE_ONLINE_CHECKIN_DAYS),
        label: "Check-in online del crucero",
        kind: "checkin-online",
        hint: "Verificar la ventana exacta en la naviera",
      });
    }
    out.push({ date: b.startDate, label: "Comienzo del viaje", kind: "checkin" });
  }
  if (b.endDate) out.push({ date: b.endDate, label: "Fin del viaje", kind: "checkout" });
  // Un vencimiento de saldo por cada reserva activa que todavía no se pagó.
  for (const item of b.items ?? []) {
    if (item.status === "CANCELLED" || !item.balanceDue || item.balancePaidAt) continue;
    out.push({ date: item.balanceDue, label: `Vence el saldo: ${item.description}`, kind: "payment", hint: item.supplier ?? undefined });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}
