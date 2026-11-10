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

/**
 * Si a esta reserva le corresponde una fecha para saldar: los paquetes (salvo Universal, donde depende de cómo se
 * compró) y lo que pide depósito. Un hotel o unos tickets pagados de una vez no la necesitan.
 */
export function expectsBalanceDue(item: { type: ItemType; depositAmount?: unknown }) {
  return (ITEM_TYPE_BASE[item.type] === "PACKAGE" && itemBrand(item.type) !== "UNIVERSAL") || (item.depositAmount !== null && item.depositAmount !== undefined);
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

/** Importe sobre el que se calcula la comisión en porcentaje: sin el tax, si está discriminado. */
export function commissionBase(item: { price: Num; taxAmount?: Num }) {
  return Math.max(Math.round((toN(item.price) - toN(item.taxAmount)) * 100) / 100, 0);
}

/**
 * Comisión de una reserva o servicio: el monto fijo si lo tiene, si no el porcentaje (o el por defecto)
 * sobre el importe sin tax.
 */
export function commissionFor(item: { price: Num; taxAmount?: Num; commissionRate: Num; commissionFixed: Num }, defaultRate: number) {
  if (item.commissionFixed !== null && item.commissionFixed !== undefined) return toN(item.commissionFixed);
  const rate = item.commissionRate === null || item.commissionRate === undefined ? defaultRate : toN(item.commissionRate);
  return Math.round(commissionBase(item) * rate) / 100;
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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Compara los viajeros marcados con la cantidad cargada en el viaje (adultos y menores, por la edad al
 * viajar). Devuelve qué falta o sobra, o null si coincide. Si alguno no tiene fecha de nacimiento, compara
 * solo el total.
 */
export function travelerCountCheck(adults: number, children: number, ages: (number | null)[]) {
  const expected = adults + children;
  const known = ages.filter((a): a is number => a !== null);
  const markedAdults = known.filter((a) => a >= 18).length;
  const markedChildren = known.filter((a) => a < 18).length;
  const unknown = ages.length - known.length;
  const want = `El viaje es para ${plural(adults, "adulto", "adultos")}${children ? ` y ${plural(children, "menor", "menores")}` : ""}`;
  const missing: string[] = [];
  const extra: string[] = [];
  const add = (d: number, one: string, many: string) => {
    if (d > 0) missing.push(plural(d, one, many));
    if (d < 0) extra.push(plural(-d, one, many));
  };
  if (unknown === 0) {
    add(adults - markedAdults, "adulto", "adultos");
    add(children - markedChildren, "menor", "menores");
  } else {
    add(expected - ages.length, "viajero", "viajeros");
  }
  // "faltan 1 adulto y 1 menor", "sobra 1 adulto".
  const verb = (list: string[], sing: string, plur: string) => `${list.length === 1 && list[0].startsWith("1 ") ? sing : plur} ${list.join(" y ")}`;
  const parts = [missing.length && verb(missing, "falta", "faltan"), extra.length && verb(extra, "sobra", "sobran")].filter((x): x is string => !!x);
  if (parts.length === 0) return null;
  const marked = ages.length === 0 ? "no marcaste a nadie" : `marcaste ${plural(ages.length, "viajero", "viajeros")}`;
  const note = unknown > 0 && parts.length ? ` (${plural(unknown, "no tiene", "no tienen")} fecha de nacimiento, así que no se sabe si es adulto o menor)` : "";
  return `${want} y ${marked}: ${parts.join(" y ")}${note}.`;
}

// ─── Reparto de la comisión con la agencia host ──────────────────────────────

type Dec = number | string | { toString(): string } | null | undefined;
const dec = (v: Dec) => (v === null || v === undefined ? null : Number(v.toString()));

/** Parte del agente (%) para una reserva: la de la reserva, si tiene; si no, la de la agencia; si no, 100. */
export function sharePercentOf(item: { agentSharePercent?: Dec }, agencyPercent?: Dec) {
  return dec(item.agentSharePercent) ?? dec(agencyPercent) ?? 100;
}

/**
 * Lo que le toca al agente de la comisión del proveedor (redondeado a centavos, por reserva, para que las
 * filas sumen exacto). La retención de la agencia es la diferencia.
 */
export function agentShareOf(item: { commissionAmount: Dec; agentSharePercent?: Dec }, agencyPercent?: Dec) {
  const provider = dec(item.commissionAmount) ?? 0;
  return Math.round(provider * sharePercentOf(item, agencyPercent)) / 100;
}
