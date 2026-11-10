import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { AlertTriangle, BedDouble, CalendarDays, Car, CheckCircle2, FileText, Hash, Building2, Plane, Plus, Package, PartyPopper, Ship, Shield, Ticket, Trash2, Users, Utensils, Bus, Sparkles, Ban, Wallet } from "lucide-react";
import { ConfirmButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, buttonClass } from "@/components/ui";
import { COMMISSION_STATUS_LABEL, ITEM_TYPE_BASE, ITEM_TYPE_LABEL, reservationStage } from "@/lib/labels";
import { ageOn, daysBetween, formatDate, formatRange, money, percent, toDateInput, toNumber } from "@/lib/format";
import { storageMode } from "@/lib/storage";
import type { ItemType } from "@/generated/prisma/enums";
import { addBookingItem, deleteBookingItem, payReservationDeposit, quickItemAction, updateBookingItem } from "../actions";
import { ReservationForm } from "./reservation-form";
import { ReservationPayments } from "./payments";
import { TripDatesGuard, type TravelerOption } from "./reservation-extras";
import type { LoadedBooking } from "./data";
import { DateInput } from "@/components/date-input";

type LoadedItem = LoadedBooking["items"][number];

const ICON: Partial<Record<ItemType, typeof Package>> = {
  PACKAGE: Package,
  HOTEL: BedDouble,
  TICKETS: Ticket,
  SPECIAL_EVENT: PartyPopper,
  CRUISE: Ship,
  FLIGHT: Plane,
  CAR: Car,
  TRANSFER: Bus,
  INSURANCE: Shield,
  DINING: Utensils,
  EXPERIENCE: Sparkles,
  OTHER: Package,
};

/**
 * Las reservas que componen el viaje, en dos grupos: las que faltan reservar con el proveedor (con la
 * confirmación como acción principal) y las reservadas. Cada una muestra de qué cotización salió, sus pagos y,
 * plegada, su comisión. La plata del viaje en cifras vive en Resumen.
 */
export function Items({
  booking: b,
  defaultRate,
  eventWarnings = {},
  payItemId,
}: {
  booking: LoadedBooking;
  defaultRate: number;
  /** Reserva con el formulario de pago abierto (viene de "Registrar pago" en el calendario). */
  payItemId?: string;
  /** Por reserva: el aviso si el evento especial no figura en esa fecha entre las cargadas en su ficha. */
  eventWarnings?: Record<string, string>;
}) {
  const directUpload = storageMode() === "r2";
  const tripTravelers = b.travelers.map((t) => t.travelerId);
  const travelerOptions = b.client.travelers.map((t) => {
    const age = ageOn(t.birthDate, b.startDate ?? undefined);
    return { id: t.id, firstName: t.firstName, lastName: t.lastName, detail: age !== null ? `${age} años` : undefined };
  });
  const groups = [
    { key: "PENDING", title: "Por reservar", hint: "Confirmalas con el proveedor y cargá el n° de confirmación.", items: b.items.filter((i) => i.status === "PENDING") },
    { key: "CONFIRMED", title: "Reservadas", hint: "Confirmadas con el proveedor. Registrá los pagos del cliente hasta saldarlas.", items: b.items.filter((i) => i.status === "CONFIRMED") },
  ];
  const cancelled = b.items.filter((i) => i.status === "CANCELLED");
  const card = (item: LoadedItem) => (
    <ItemCard
      key={item.id}
      item={item}
      booking={b}
      defaultRate={defaultRate}
      warning={eventWarnings[item.id]}
      travelerOptions={travelerOptions}
      directUpload={directUpload}
      openPay={item.id === payItemId}
    />
  );

  return (
    <div className="space-y-6">
      {b.items.length === 0 && (
        <p className="text-sm text-slate-500">
          Un viaje se compone de varias reservas: el paquete, los tickets, el auto, unas noches de hotel… Llegan solas cuando el cliente acepta una{" "}
          <Link href={`/app/viajes/${b.id}?tab=cotizaciones`} className="text-brand-700 hover:underline">
            cotización
          </Link>
          , o las cargás acá.
        </p>
      )}

      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <section key={g.key} className="space-y-3">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {g.title} <span className="font-normal text-slate-500">({g.items.length})</span>
                </h3>
                <p className="text-xs text-slate-500">{g.hint}</p>
              </div>
              <p className="text-sm font-semibold text-slate-900 tabular-nums">{money(g.items.reduce((t, i) => t + toNumber(i.price), 0), b.currency)}</p>
            </header>
            {g.items.map(card)}
          </section>
        ))}

      {cancelled.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-medium text-slate-600 hover:underline">
            {cancelled.length} {cancelled.length === 1 ? "reserva cancelada" : "reservas canceladas"}
          </summary>
          <div className="mt-3 space-y-3">{cancelled.map(card)}</div>
        </details>
      )}

      <Card>
        <details open={b.items.length === 0}>
          <summary className="cursor-pointer list-none">
            <CardHeader title={<span className="flex items-center gap-2"><Plus className="size-4" /> Agregar reserva a mano</span>} description="Paquete, tickets, hotel, auto, vuelo, seguro…" />
          </summary>
          <div className="p-5">
            <ReservationForm
              action={addBookingItem.bind(null, b.id)}
              defaultRate={defaultRate}
              currency={b.currency}
              trip={b}
              travelers={travelerOptions}
              selectedTravelers={tripTravelers}
              directUpload={directUpload}
              submitLabel="Agregar reserva"
            />
          </div>
        </details>
      </Card>
    </div>
  );
}

function ItemCard({
  item,
  booking: b,
  defaultRate,
  warning,
  travelerOptions,
  directUpload,
  openPay = false,
}: {
  item: LoadedItem;
  booking: LoadedBooking;
  defaultRate: number;
  warning?: string;
  travelerOptions: TravelerOption[];
  directUpload: boolean;
  openPay?: boolean;
}) {
  const Icon = ICON[ITEM_TYPE_BASE[item.type]] ?? Package;
  const stage = reservationStage(item);
  const source = item.quoteItem?.option;
  return (
    <Card id={`reserva-${item.id}`} className={clsx("scroll-mt-6", item.status === "CANCELLED" && "opacity-60")}>
      <div className="flex flex-wrap items-start gap-4 p-4">
        <span className="flex size-6 shrink-0 items-center justify-center text-slate-500">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{ITEM_TYPE_LABEL[item.type]}</span>
            <Badge className={stage.color}>{stage.label}</Badge>
            {source && (
              <Link href={`/app/viajes/${b.id}?tab=cotizaciones`} className="text-xs text-slate-500 hover:text-brand-700 hover:underline">
                De: {source.quote.title}
                {source.quote._count.options > 1 && ` · ${source.name}`}
              </Link>
            )}
          </div>
          <p className="font-medium text-slate-900">{item.description}</p>
          <ReservationBasics item={item} trip={b} />
          {warning && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
              <AlertTriangle className="mt-px size-3.5 shrink-0" /> {warning} Revisá la fecha de la reserva.
            </p>
          )}
          <ReservationPayments item={item} currency={b.currency} open={openPay} />
        </div>
        <div className="ml-14 sm:ml-0 sm:text-right">
          <p className="font-semibold text-slate-900">{money(item.price, b.currency)}</p>
          {item.taxAmount !== null && toNumber(item.taxAmount) > 0 && <p className="text-[11px] text-slate-500">Incluye tax {money(item.taxAmount, b.currency)}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2">
        {item.status === "PENDING" && <ConfirmReservation item={item} trip={b} />}
        {/* El depósito es lo próximo que paga el cliente: a mano, en un clic. */}
        {item.status !== "CANCELLED" && item.depositAmount !== null && toNumber(item.paidAmount) < toNumber(item.depositAmount) && (
          <form action={payReservationDeposit.bind(null, item.id)}>
            <button className={buttonClass("secondary", "sm")}>
              <Wallet className="size-3.5" /> Registrar depósito {money(toNumber(item.depositAmount) - toNumber(item.paidAmount), b.currency)}
            </button>
          </form>
        )}
        {item.status !== "CANCELLED" && (
          <form action={quickItemAction.bind(null, item.id, "cancel")}>
            <ConfirmButton variant="ghost" message={`¿Cancelar "${item.description}"? Deja de sumar al total y a las comisiones.`}>
              <Ban className="size-3.5" /> Cancelar
            </ConfirmButton>
          </form>
        )}
        {/* La comisión, plegada: se sigue en Comisiones. */}
        <details className="group ml-auto text-right open:basis-full open:text-left">
          <summary className="cursor-pointer list-none text-xs text-slate-500 hover:text-slate-800">
            Comisión <span className="font-semibold text-emerald-700">{money(item.commissionAmount, b.currency)}</span> · {COMMISSION_STATUS_LABEL[item.commissionStatus]}
          </summary>
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {item.commissionFixed !== null ? "Monto fijo" : `${percent(item.commissionRate ?? defaultRate)} sobre el importe${item.taxAmount !== null ? " sin tax" : ""}`}
            {item.saleDate && ` · Vendida el ${formatDate(item.saleDate)}`}
            {item.commissionPaidAt && ` · Cobrada el ${formatDate(item.commissionPaidAt)}`}. Se cobra desde{" "}
            <Link href="/app/comisiones" className="text-brand-700 hover:underline">
              Comisiones
            </Link>
            ; el porcentaje y el estado de cobro se cambian en «Editar todos los datos».
          </p>
        </details>
        <details className="group w-full">
          <summary className="cursor-pointer list-none text-xs font-medium text-brand-700">Editar todos los datos</summary>
          <div className="pt-4 pb-2">
            <ReservationForm
              action={updateBookingItem.bind(null, item.id)}
              item={item}
              defaultRate={defaultRate}
              currency={b.currency}
              trip={b}
              travelers={travelerOptions}
              selectedTravelers={item.travelers.map((t) => t.travelerId)}
              directUpload={directUpload}
              submitLabel="Guardar reserva"
            />
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
function ReservationBasics({ item, trip }: { item: LoadedItem; trip: { startDate: Date | null; endDate: Date | null } }) {
  const missing = [!item.startDate && "las fechas", !item.confirmationNumber && "el n° de confirmación"].filter(Boolean) as string[];
  const flag = item.status === "CONFIRMED" && missing.length > 0;
  const empty = (text: string) => <span className={flag ? "text-amber-700" : "text-slate-500"}>{text}</span>;
  return (
    <div className="mt-2 space-y-1.5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Datum icon={CalendarDays} label="Fechas">
          {item.startDate ? (
            <>
              {item.endDate ? `${formatDate(item.startDate)} → ${formatDate(item.endDate)}` : `Desde ${formatDate(item.startDate)}`}
              {duration(item) && <span className="text-slate-500"> · {duration(item)}</span>}
            </>
          ) : trip.startDate ? (
            empty(`Las del viaje (${formatRange(trip.startDate, trip.endDate)})`)
          ) : (
            empty("Sin fechas")
          )}
        </Datum>
        <Datum icon={Building2} label="Proveedor">
          {item.supplier ?? <span className="text-slate-500">—</span>}
        </Datum>
        <Datum icon={Hash} label="Confirmación">
          {item.confirmationNumber ? <span className="font-mono">{item.confirmationNumber}</span> : empty(item.status === "PENDING" ? "Sin confirmar" : "Sin número")}
        </Datum>
      </dl>
      {item.notes && <p className="text-xs whitespace-pre-line text-slate-600">{item.notes}</p>}
      {item.travelers.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-slate-600">
          <Users className="mt-px size-3.5 shrink-0 text-slate-500" />
          {item.travelers.map((t) => [t.traveler.firstName, t.traveler.lastName].filter(Boolean).join(" ")).join(", ")}
        </p>
      )}
      {item.documents.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {item.documents.map((d) => (
            <li key={d.id}>
              <a
                href={d.storageKey ? `/api/archivos/${d.id}` : (d.url ?? "#")}
                target="_blank"
                className="inline-flex max-w-56 items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-brand-50 hover:text-brand-700"
              >
                <FileText className="size-3 shrink-0" /> <span className="truncate">{d.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
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
      <dt className="flex items-center gap-1 text-xs font-medium text-slate-500">
        <Icon className="size-3" /> {label}
      </dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}

/** Confirmar con el proveedor: en un paso, el n° de confirmación, las fechas, el depósito y cuándo hay que saldarla. */
function ConfirmReservation({ item, trip }: { item: LoadedItem; trip: { startDate: Date | null; endDate: Date | null } }) {
  return (
    <details className="group open:basis-full">
      <summary className={clsx(buttonClass("primary", "sm"), "list-none")}>
        <CheckCircle2 className="size-3.5" /> Confirmar con el proveedor
      </summary>
      <form action={quickItemAction.bind(null, item.id, "confirm")} className="mt-2 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
        <TripDatesGuard tripStart={toDateInput(trip.startDate) || null} tripEnd={toDateInput(trip.endDate) || null} />
        <label className="block">
          <span className="label">N° de confirmación</span>
          <input name="confirmationNumber" defaultValue={item.confirmationNumber ?? ""} className="field" />
        </label>
        <label className="block">
          <span className="label">Desde</span>
          <DateInput name="startDate" defaultValue={toDateInput(item.startDate)} />
        </label>
        <label className="block">
          <span className="label">Hasta</span>
          <DateInput name="endDate" defaultValue={toDateInput(item.endDate)} />
        </label>
        <label className="block">
          <span className="label">Depósito para reservar</span>
          <input type="number" step="0.01" min={0} name="depositAmount" defaultValue={item.depositAmount?.toString() ?? ""} className="field" />
        </label>
        <label className="block">
          <span className="label">Saldar antes del</span>
          <DateInput name="balanceDue" defaultValue={toDateInput(item.balanceDue)} />
        </label>
        <div className="flex items-end">
          <button className={buttonClass("primary", "sm", "w-full")}>
            <CheckCircle2 className="size-3.5" /> Confirmar reserva
          </button>
        </div>
        {(trip.startDate || trip.endDate) && <p className="text-xs text-slate-500 sm:col-span-3">Viaje: {formatRange(trip.startDate, trip.endDate)}. Lo que dejes vacío se puede completar después.</p>}
      </form>
    </details>
  );
}

