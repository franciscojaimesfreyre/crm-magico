// Fechas clave de un viaje. Cada reserva aporta las suyas según su tipo y proveedor, calculadas con
// las fechas de esa reserva (no las del viaje): un paquete de Disney trae la apertura de restaurantes
// y de Lightning Lane según su check-in, un crucero su check-in online, un auto el retiro, etc.
// Función pura (cliente y servidor).
import type { Destination } from "@/generated/prisma/enums";
import { addDays, money } from "@/lib/format";
import { ITEM_TYPE_BASE, itemBrand } from "@/lib/labels";
import type { ItemType } from "@/generated/prisma/enums";

export type KeyDate = {
  date: Date;
  label: string;
  kind:
    | "dining"
    | "lightning"
    | "payment"
    | "deposit"
    | "checkin"
    | "checkout"
    | "checkin-online"
    | "stay-in"
    | "stay-out"
    | "pickup"
    | "dropoff"
    | "flight"
    | "park";
  hint?: string;
};

// Ventanas configurables: si Disney, Universal o las navieras las cambian, se ajustan acá.
export const DINING_WINDOW_DAYS = 60;
export const LIGHTNING_LANE_ONSITE_DAYS = 7;
export const CRUISE_ONLINE_CHECKIN_DAYS = 30;
export const FLIGHT_ONLINE_CHECKIN_DAYS = 1;

type Num = number | string | { toString(): string } | null | undefined;

type ReservationInput = {
  type: string;
  description: string;
  supplier: string | null;
  status: string;
  startDate: Date | null;
  endDate?: Date | null;
  balanceDue: Date | null;
  balancePaidAt: Date | null;
  price?: Num;
  paidAmount?: Num;
  flightLegs?: { direction: string; date: Date | null; time: string | null; airline: string | null; flightNumber: string | null }[];
};

type Input = {
  destination?: Destination;
  currency?: string;
  startDate: Date | null;
  endDate: Date | null;
  items?: ReservationInput[];
};

const n = (v: Num) => (v === null || v === undefined ? 0 : Number(v.toString()));
/** Estadías en parques de Disney: por el tipo específico o, en los genéricos, por proveedor/descripción. */
function disneyParks(i: ReservationInput) {
  const brand = itemBrand(i.type);
  if (brand) return brand === "DISNEY_WORLD" || brand === "DISNEYLAND" ? brand : null;
  const text = `${i.supplier ?? ""} ${i.description}`;
  if (/disneyland/i.test(text)) return "DISNEYLAND";
  return /disney/i.test(text) && !/cruise|crucero/i.test(text) ? "DISNEY_WORLD" : null;
}

/** Fechas clave que aporta una reserva, según su tipo y proveedor. */
function reservationKeyDates(i: ReservationInput, currency: string): KeyDate[] {
  const out: KeyDate[] = [];
  const name = i.description;
  const start = i.startDate;
  const end = i.endDate ?? null;

  if (start) {
    switch (ITEM_TYPE_BASE[i.type as ItemType] ?? i.type) {
      case "PACKAGE":
      case "HOTEL":
        if (disneyParks(i)) {
          out.push({
            date: addDays(start, -DINING_WINDOW_DAYS),
            label: "Abren las reservas de restaurantes",
            kind: "dining",
            hint: `${DINING_WINDOW_DAYS} días antes del check-in · ${name}`,
          });
        }
        // Lightning Lane anticipado (7 días) es para huéspedes de hoteles de Walt Disney World.
        if (disneyParks(i) === "DISNEY_WORLD") {
          out.push({
            date: addDays(start, -LIGHTNING_LANE_ONSITE_DAYS),
            label: "Abre la reserva de Lightning Lane",
            kind: "lightning",
            hint: `${LIGHTNING_LANE_ONSITE_DAYS} días antes del check-in (huéspedes de hoteles Disney) · ${name}`,
          });
        }
        out.push({ date: start, label: `Check-in: ${name}`, kind: "stay-in", hint: i.supplier ?? undefined });
        if (end) out.push({ date: end, label: `Check-out: ${name}`, kind: "stay-out", hint: i.supplier ?? undefined });
        break;
      case "CRUISE":
        out.push({
          date: addDays(start, -CRUISE_ONLINE_CHECKIN_DAYS),
          label: "Check-in online del crucero",
          kind: "checkin-online",
          hint: `Verificar la ventana exacta en la naviera · ${name}`,
        });
        out.push({ date: start, label: `Embarque: ${name}`, kind: "stay-in", hint: i.supplier ?? undefined });
        if (end) out.push({ date: end, label: `Desembarque: ${name}`, kind: "stay-out", hint: i.supplier ?? undefined });
        break;
      case "FLIGHT": {
        const legs = (i.flightLegs ?? []).filter((l) => l.date);
        if (legs.length === 0) {
          out.push({
            date: addDays(start, -FLIGHT_ONLINE_CHECKIN_DAYS),
            label: "Check-in online del vuelo",
            kind: "checkin-online",
            hint: `Suele abrir 24 a 48 h antes · ${name}`,
          });
          out.push({ date: start, label: `Vuelo: ${name}`, kind: "flight", hint: i.supplier ?? undefined });
          if (end) out.push({ date: end, label: `Vuelo de regreso: ${name}`, kind: "flight", hint: i.supplier ?? undefined });
        }
        break;
      }
      case "CAR":
        out.push({ date: start, label: `Retiro del auto: ${name}`, kind: "pickup", hint: i.supplier ?? undefined });
        if (end) out.push({ date: end, label: `Devolución del auto: ${name}`, kind: "dropoff", hint: i.supplier ?? undefined });
        break;
      case "TICKETS":
        out.push({
          date: start,
          label: `Primer día de parque: ${name}`,
          kind: "park",
          hint: i.supplier ?? undefined,
        });
        break;
      case "TRANSFER":
        out.push({ date: start, label: `Traslado: ${name}`, kind: "pickup", hint: i.supplier ?? undefined });
        break;
    }
  }

  // Vuelos con tramos cargados: cada tramo trae su check-in online y su salida.
  if (ITEM_TYPE_BASE[i.type as ItemType] === "FLIGHT") {
    for (const l of i.flightLegs ?? []) {
      if (!l.date) continue;
      const what = l.direction === "OUTBOUND" ? "ida" : "vuelta";
      const flight = [l.airline, l.flightNumber].filter(Boolean).join(" ");
      out.push({
        date: addDays(l.date, -FLIGHT_ONLINE_CHECKIN_DAYS),
        label: `Check-in online del vuelo de ${what}`,
        kind: "checkin-online",
        hint: `Suele abrir 24 a 48 h antes${flight ? ` · ${flight}` : ""}`,
      });
      out.push({
        date: l.date,
        label: `Vuelo de ${what}${flight ? `: ${flight}` : ""}${l.time ? ` · ${l.time}` : ""}`,
        kind: "flight",
        hint: name,
      });
    }
  }

  // Fecha límite para saldar la reserva, si todavía resta pagar.
  const price = n(i.price);
  const paid = n(i.paidAmount);
  if (i.balanceDue && !i.balancePaidAt && (price === 0 || paid < price)) {
    out.push({
      date: i.balanceDue,
      label: `Saldar: ${name}`,
      kind: "payment",
      hint: price > 0 ? `Resta ${money(price - paid, currency)}${i.supplier ? ` · ${i.supplier}` : ""}` : (i.supplier ?? undefined),
    });
  }
  return out;
}

export function computeKeyDates(b: Input): KeyDate[] {
  const out: KeyDate[] = [];
  if (b.startDate) out.push({ date: b.startDate, label: "Comienzo del viaje", kind: "checkin" });
  if (b.endDate) out.push({ date: b.endDate, label: "Fin del viaje", kind: "checkout" });

  for (const item of b.items ?? []) {
    if (item.status === "CANCELLED") continue;
    out.push(...reservationKeyDates(item, b.currency ?? "USD"));
  }

  // Si dos reservas dan la misma ventana el mismo día (ej. paquete y hotel de Disney), se muestra una sola.
  const seen = new Set<string>();
  return out
    .filter((k) => {
      if (k.kind !== "dining" && k.kind !== "lightning") return true;
      const key = `${k.kind}:${k.date.toISOString().slice(0, 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
