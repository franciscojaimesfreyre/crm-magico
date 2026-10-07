// Utilidades de viajes (sin dependencias de servidor).
import { ITEM_TYPE_BASE, itemBrand } from "@/lib/labels";
import type { ItemType } from "@/generated/prisma/enums";

type ReservationLike = { type: string; status: string; description: string };

/**
 * Alojamiento principal del viaje: la primera reserva activa de paquete, hotel o crucero.
 * El viaje no guarda el hotel; esa información vive en sus reservas.
 */
export function mainStay(items: ReservationLike[] | undefined) {
  return items?.find((i) => i.status !== "CANCELLED" && ["PACKAGE", "HOTEL", "CRUISE"].includes(ITEM_TYPE_BASE[i.type as ItemType]))?.description ?? null;
}

/** Días antes de la llegada en que hay que tener saldado un paquete (regla de Disney). */
export const PACKAGE_FINAL_PAYMENT_DAYS = 30;

/**
 * Fecha límite sugerida para saldar: en paquetes de Disney (y paquetes genéricos), 30 días antes de la llegada.
 * En los de Universal no se sugiere: la regla depende de cómo se compró.
 */
export function suggestedBalanceDue(type: ItemType, arrival: Date | null) {
  if (ITEM_TYPE_BASE[type] !== "PACKAGE" || itemBrand(type) === "UNIVERSAL" || !arrival) return null;
  return new Date(arrival.getTime() - PACKAGE_FINAL_PAYMENT_DAYS * 86_400_000);
}

type Num = number | string | { toString(): string } | null | undefined;
const toN = (v: Num) => (v === null || v === undefined ? 0 : Number(v.toString()));

/** Estado de pagos de una reserva: cuánto se pagó, cuánto falta y si ya cubre el depósito. */
export function paymentProgress(item: { price: Num; paidAmount: Num; depositAmount: Num }) {
  const price = toN(item.price);
  const paid = toN(item.paidAmount);
  const deposit = item.depositAmount === null || item.depositAmount === undefined ? null : toN(item.depositAmount);
  const remaining = Math.max(Math.round((price - paid) * 100) / 100, 0);
  return {
    price,
    paid,
    remaining,
    settled: price > 0 && remaining === 0,
    depositCovered: deposit === null ? null : paid >= deposit,
    percent: price > 0 ? Math.min(Math.round((paid / price) * 100), 100) : 0,
  };
}

/** Comisión de una reserva o servicio: el monto fijo si lo tiene, si no el porcentaje (o el por defecto). */
export function commissionFor(item: { price: Num; commissionRate: Num; commissionFixed: Num }, defaultRate: number) {
  if (item.commissionFixed !== null && item.commissionFixed !== undefined) return toN(item.commissionFixed);
  const rate = item.commissionRate === null || item.commissionRate === undefined ? defaultRate : toN(item.commissionRate);
  return Math.round(toN(item.price) * rate) / 100;
}

/** Lee el campo de comisión de un formulario (CommissionInput): porcentaje o monto fijo. */
export function commissionFromForm(formData: FormData) {
  const raw = String(formData.get("commissionValue") ?? "").trim().replace(",", ".");
  const value = raw === "" ? null : Number(raw);
  const valid = value !== null && Number.isFinite(value) && value >= 0 ? value : null;
  return formData.get("commissionMode") === "fixed"
    ? { commissionRate: null, commissionFixed: valid }
    : { commissionRate: valid, commissionFixed: null };
}

type LegLike = { direction: string; date: Date | null; time: string | null; airline: string | null; flightNumber: string | null };

/** Tramos ordenados (ida, vuelta) con un texto listo para mostrar: "Ida · 08/03 08:30 · American AA 1234". */
export function describeFlightLegs(legs: LegLike[] | undefined, formatDate: (d: Date | null) => string) {
  return [...(legs ?? [])]
    .sort((a, b) => (a.direction === "OUTBOUND" ? -1 : 1) - (b.direction === "OUTBOUND" ? -1 : 1))
    .map((l) => ({
      direction: l.direction,
      label: l.direction === "OUTBOUND" ? "Ida" : "Vuelta",
      when: [l.date && formatDate(l.date), l.time].filter(Boolean).join(" "),
      flight: [l.airline, l.flightNumber].filter(Boolean).join(" "),
    }));
}
