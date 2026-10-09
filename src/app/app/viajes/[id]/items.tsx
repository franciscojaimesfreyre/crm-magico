import clsx from "clsx";
import type { ReactNode } from "react";
import { AlertTriangle, BedDouble, CalendarDays, Car, CheckCircle2, Hash, Building2, Plane, Plus, Package, Ship, Shield, Ticket, Trash2, Utensils, Bus, Sparkles, Ban } from "lucide-react";
import { ConfirmButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, buttonClass } from "@/components/ui";
import {
  COMMISSION_STATUS_COLOR,
  COMMISSION_STATUS_LABEL,
  ITEM_TYPE_BASE,
  ITEM_TYPE_LABEL,
  RESERVATION_STATUS_COLOR,
  RESERVATION_STATUS_LABEL,
} from "@/lib/labels";
import { daysBetween, formatDate, formatRange, money, percent, toDateInput, toNumber } from "@/lib/format";
import type { ItemType } from "@/generated/prisma/enums";
import { paymentProgress } from "@/lib/trips";
import { addBookingItem, deleteBookingItem, quickItemAction, updateBookingItem } from "../actions";
import { ReservationForm } from "./reservation-form";
import { ReservationPayments } from "./payments";
import { TripDatesGuard } from "./reservation-extras";
import type { LoadedBooking } from "./data";

type LoadedItem = LoadedBooking["items"][number];

const ICON: Partial<Record<ItemType, typeof Package>> = {
  PACKAGE: Package,
  HOTEL: BedDouble,
  TICKETS: Ticket,
  CRUISE: Ship,
  FLIGHT: Plane,
  CAR: Car,
  TRANSFER: Bus,
  INSURANCE: Shield,
  DINING: Utensils,
  EXPERIENCE: Sparkles,
  OTHER: Package,
};

/** Las reservas que componen el viaje: cada una con su proveedor, pagos y comisión. */
export function Items({ booking: b, defaultRate }: { booking: LoadedBooking; defaultRate: number }) {
  const active = b.items.filter((i) => i.status !== "CANCELLED");
  const progress = active.map((i) => ({ item: i, ...paymentProgress(i) }));
  const paid = progress.reduce((t, p) => t + p.paid, 0);
  const remaining = progress.reduce((t, p) => t + p.remaining, 0);
  const nextDue = progress
    .filter((p) => p.remaining > 0 && p.item.balanceDue)
    .sort((x, y) => x.item.balanceDue!.getTime() - y.item.balanceDue!.getTime())[0];
  const commissionPaid = active
    .filter((i) => i.commissionStatus === "PAID")
    .reduce((s, i) => s + toNumber(i.commissionPaidAmount ?? i.commissionAmount), 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Un viaje se compone de varias reservas: por ejemplo, el paquete de Disney, los tickets de Universal, el auto y unas noches de hotel en Orlando.
        Cada una tiene su proveedor, su confirmación, sus pagos y su comisión. Los totales del viaje se calculan solos.
      </p>

      {b.items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-5">
          <Total label="Total del viaje" value={money(b.totalPrice, b.currency)} hint={`${active.length} reservas activas`} />
          <Total label="Pagado por el cliente" value={money(paid, b.currency)} hint={`Resta ${money(remaining, b.currency)}`} />
          <Total label="Próximo vencimiento" value={nextDue ? formatDate(nextDue.item.balanceDue) : "—"} hint={nextDue ? `${money(nextDue.remaining, b.currency)} · ${nextDue.item.description}` : "Sin saldos pendientes"} />
          <Total label="Comisión del viaje" value={money(b.commissionAmount, b.currency)} />
          <Total label="Comisión cobrada" value={money(commissionPaid, b.currency)} />
        </div>
      )}

      {b.items.map((item) => {
        const Icon = ICON[ITEM_TYPE_BASE[item.type]] ?? Package;
        return (
          <Card key={item.id} className={clsx(item.status === "CANCELLED" && "opacity-60")}>
            <div className="flex flex-wrap items-start gap-4 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">{ITEM_TYPE_LABEL[item.type]}</span>
                  <Badge className={RESERVATION_STATUS_COLOR[item.status]}>{RESERVATION_STATUS_LABEL[item.status]}</Badge>
                </div>
                <p className="font-medium text-slate-900">{item.description}</p>
                <ReservationBasics item={item} />
                <ReservationPayments item={item} currency={b.currency} />
              </div>
              <div className="ml-14 sm:ml-0 sm:text-right">
                <p className="font-semibold text-slate-900">{money(item.price, b.currency)}</p>
                <p className="text-xs text-emerald-700">
                  Comisión {money(item.commissionAmount, b.currency)} <span className="text-slate-400">({item.commissionFixed !== null ? "monto fijo" : percent(item.commissionRate ?? defaultRate)})</span>
                </p>
                <Badge className={clsx("mt-1", COMMISSION_STATUS_COLOR[item.commissionStatus])}>{COMMISSION_STATUS_LABEL[item.commissionStatus]}</Badge>
                {item.saleDate && <p className="text-[11px] text-slate-400">Vendida el {formatDate(item.saleDate)}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2">
              {item.status === "PENDING" && <ConfirmReservation item={item} trip={b} />}
              {item.status !== "CANCELLED" && (
                <form action={quickItemAction.bind(null, item.id, "cancel")}>
                  <ConfirmButton variant="ghost" message={`¿Cancelar "${item.description}"? Deja de sumar al total y a las comisiones.`}>
                    <Ban className="size-3.5" /> Cancelar
                  </ConfirmButton>
                </form>
              )}
              <details className="group w-full">
                <summary className="cursor-pointer list-none text-xs font-medium text-brand-700">Editar todos los datos</summary>
                <div className="pt-4 pb-2">
                  <ReservationForm action={updateBookingItem.bind(null, item.id)} item={item} defaultRate={defaultRate} currency={b.currency} trip={b} submitLabel="Guardar reserva" />
                  <form action={deleteBookingItem.bind(null, item.id)} className="mt-3">
                    <ConfirmButton message="¿Eliminar esta reserva? Si ya figura en una planilla de comisiones, también se quita de ahí.">
                      <Trash2 className="size-3.5" /> Eliminar reserva
                    </ConfirmButton>
                  </form>
                </div>
              </details>
            </div>
          </Card>
        );
      })}

      <Card>
        <details open={b.items.length === 0}>
          <summary className="cursor-pointer list-none">
            <CardHeader title={<span className="flex items-center gap-2"><Plus className="size-4" /> Agregar reserva</span>} description="Paquete, tickets, hotel, auto, vuelo, seguro…" />
          </summary>
          <div className="p-5">
            <ReservationForm action={addBookingItem.bind(null, b.id)} defaultRate={defaultRate} currency={b.currency} trip={b} submitLabel="Agregar reserva" />
          </div>
        </details>
      </Card>
    </div>
  );
}

/** Tipos que se miden en noches (alojamiento); el resto, en días. */
const STAY_TYPES: ItemType[] = ["PACKAGE", "HOTEL", "CRUISE"];

function duration(item: LoadedItem) {
  if (!item.startDate || !item.endDate) return null;
  const days = daysBetween(item.startDate, item.endDate);
  if (STAY_TYPES.includes(ITEM_TYPE_BASE[item.type])) return days > 0 ? `${days} ${days === 1 ? "noche" : "noches"}` : null;
  return `${days + 1} ${days === 0 ? "día" : "días"}`;
}

/** Datos básicos de la reserva, siempre visibles. Si está confirmada y falta algo, lo marca. */
function ReservationBasics({ item }: { item: LoadedItem }) {
  const missing = [!item.startDate && "las fechas", !item.confirmationNumber && "el n° de confirmación"].filter(Boolean) as string[];
  const flag = item.status === "CONFIRMED" && missing.length > 0;
  const empty = (text: string) => <span className={flag ? "text-amber-700" : "text-slate-400"}>{text}</span>;
  return (
    <div className="mt-2 space-y-1.5">
      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Datum icon={CalendarDays} label="Fechas">
          {item.startDate ? (
            <>
              {item.endDate ? `${formatDate(item.startDate)} → ${formatDate(item.endDate)}` : `Desde ${formatDate(item.startDate)}`}
              {duration(item) && <span className="text-slate-500"> · {duration(item)}</span>}
            </>
          ) : (
            empty("Sin fechas")
          )}
        </Datum>
        <Datum icon={Building2} label="Proveedor">
          {item.supplier ?? <span className="text-slate-400">—</span>}
        </Datum>
        <Datum icon={Hash} label="Confirmación">
          {item.confirmationNumber ? <span className="font-mono">{item.confirmationNumber}</span> : empty(item.status === "PENDING" ? "Sin confirmar" : "Sin número")}
        </Datum>
      </dl>
      {item.notes && <p className="text-xs whitespace-pre-line text-slate-600">{item.notes}</p>}
      {flag && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="size-3.5 shrink-0" /> Está confirmada pero falta cargar {missing.join(" y ")}. Completalo en «Editar todos los datos».
        </p>
      )}
    </div>
  );
}

function Datum({ icon: Icon, label, children }: { icon: typeof Package; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
        <Icon className="size-3" /> {label}
      </dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}

/** Confirmar con el proveedor: aprovecha para cargar el n° de confirmación y las fechas. */
function ConfirmReservation({ item, trip }: { item: LoadedItem; trip: { startDate: Date | null; endDate: Date | null } }) {
  return (
    <details className="group open:basis-full">
      <summary className={clsx(buttonClass("secondary", "sm"), "list-none")}>
        <CheckCircle2 className="size-3.5" /> Confirmar
      </summary>
      <form action={quickItemAction.bind(null, item.id, "confirm")} className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4">
        <TripDatesGuard tripStart={toDateInput(trip.startDate) || null} tripEnd={toDateInput(trip.endDate) || null} />
        <label className="block">
          <span className="label">N° de confirmación</span>
          <input name="confirmationNumber" defaultValue={item.confirmationNumber ?? ""} className="field" />
        </label>
        <label className="block">
          <span className="label">Desde</span>
          <input type="date" name="startDate" defaultValue={toDateInput(item.startDate)} className="field" />
        </label>
        <label className="block">
          <span className="label">Hasta</span>
          <input type="date" name="endDate" defaultValue={toDateInput(item.endDate)} className="field" />
        </label>
        <div className="flex items-end">
          <button className={buttonClass("primary", "sm", "w-full")}>
            <CheckCircle2 className="size-3.5" /> Confirmar reserva
          </button>
        </div>
        {(trip.startDate || trip.endDate) && <p className="text-xs text-slate-500 sm:col-span-4">Viaje: {formatRange(trip.startDate, trip.endDate)}. Lo que dejes vacío se puede completar después.</p>}
      </form>
    </details>
  );
}

function Total({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}
