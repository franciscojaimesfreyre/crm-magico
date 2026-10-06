import clsx from "clsx";
import { BedDouble, Car, CheckCircle2, Plane, Plus, Package, Ship, Shield, Ticket, Trash2, Utensils, Bus, Sparkles, Ban, Wallet } from "lucide-react";
import { ConfirmButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, buttonClass } from "@/components/ui";
import {
  COMMISSION_STATUS_COLOR,
  COMMISSION_STATUS_LABEL,
  ITEM_TYPE_LABEL,
  RESERVATION_STATUS_COLOR,
  RESERVATION_STATUS_LABEL,
} from "@/lib/labels";
import { daysBetween, formatDate, formatRange, money, percent, todayUTC, toNumber } from "@/lib/format";
import type { ItemType } from "@/generated/prisma/enums";
import { addBookingItem, deleteBookingItem, quickItemAction, updateBookingItem } from "../actions";
import { ReservationForm } from "./reservation-form";
import type { LoadedBooking } from "./data";

const ICON: Record<ItemType, typeof Package> = {
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
  const today = todayUTC();
  const active = b.items.filter((i) => i.status !== "CANCELLED");
  const pendingBalance = active.filter((i) => i.balanceDue && !i.balancePaidAt);
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
        <div className="grid gap-3 sm:grid-cols-4">
          <Total label="Total del viaje" value={money(b.totalPrice, b.currency)} hint={`${active.length} reservas activas`} />
          <Total label="Saldos por pagar" value={String(pendingBalance.length)} hint={pendingBalance[0] ? `Próximo: ${formatDate(pendingBalance.sort((x, y) => x.balanceDue!.getTime() - y.balanceDue!.getTime())[0].balanceDue)}` : "Ninguno"} />
          <Total label="Comisión del viaje" value={money(b.commissionAmount, b.currency)} />
          <Total label="Comisión cobrada" value={money(commissionPaid, b.currency)} />
        </div>
      )}

      {b.items.map((item) => {
        const Icon = ICON[item.type];
        const dueIn = item.balanceDue && !item.balancePaidAt ? daysBetween(today, item.balanceDue) : null;
        return (
          <Card key={item.id} className={clsx(item.status === "CANCELLED" && "opacity-60")}>
            <div className="flex flex-wrap items-start gap-4 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">{ITEM_TYPE_LABEL[item.type]}</span>
                  <Badge className={RESERVATION_STATUS_COLOR[item.status]}>{RESERVATION_STATUS_LABEL[item.status]}</Badge>
                </div>
                <p className="font-medium text-slate-900">{item.description}</p>
                <p className="text-xs text-slate-500">
                  {[item.supplier, item.confirmationNumber && `Conf. ${item.confirmationNumber}`, item.startDate && formatRange(item.startDate, item.endDate)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {item.notes && <p className="mt-1 text-xs whitespace-pre-line text-slate-500">{item.notes}</p>}
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {item.depositAmount !== null && (
                    <span className={item.depositPaidAt ? "text-emerald-700" : "text-amber-700"}>
                      Depósito {money(item.depositAmount, b.currency)} {item.depositPaidAt ? "· pagado" : "· pendiente"}
                    </span>
                  )}
                  {item.balancePaidAt ? (
                    <span className="text-emerald-700">Saldo pagado el {formatDate(item.balancePaidAt)}</span>
                  ) : item.balanceDue ? (
                    <span className={clsx(dueIn !== null && dueIn <= 14 ? "font-medium text-rose-600" : "text-slate-600")}>
                      Saldo vence el {formatDate(item.balanceDue)}
                      {dueIn !== null && (dueIn < 0 ? " (vencido)" : ` (en ${dueIn} días)`)}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-900">{money(item.price, b.currency)}</p>
                <p className="text-xs text-emerald-700">
                  Comisión {money(item.commissionAmount, b.currency)} <span className="text-slate-400">({percent(item.commissionRate ?? defaultRate)})</span>
                </p>
                <Badge className={clsx("mt-1", COMMISSION_STATUS_COLOR[item.commissionStatus])}>{COMMISSION_STATUS_LABEL[item.commissionStatus]}</Badge>
                {item.saleDate && <p className="text-[11px] text-slate-400">Vendida el {formatDate(item.saleDate)}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2">
              {item.status === "PENDING" && (
                <form action={quickItemAction.bind(null, item.id, "confirm")}>
                  <button className={buttonClass("secondary", "sm")}>
                    <CheckCircle2 className="size-3.5" /> Confirmar
                  </button>
                </form>
              )}
              {item.status === "CONFIRMED" && item.balanceDue && !item.balancePaidAt && (
                <form action={quickItemAction.bind(null, item.id, "balancePaid")}>
                  <button className={buttonClass("secondary", "sm")}>
                    <Wallet className="size-3.5" /> Saldo pagado
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
              <details className="group w-full">
                <summary className="cursor-pointer list-none text-xs font-medium text-brand-700">Editar todos los datos</summary>
                <div className="pt-4 pb-2">
                  <ReservationForm action={updateBookingItem.bind(null, item.id)} item={item} defaultRate={defaultRate} submitLabel="Guardar reserva" />
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
            <ReservationForm action={addBookingItem.bind(null, b.id)} defaultRate={defaultRate} submitLabel="Agregar reserva" />
          </div>
        </details>
      </Card>
    </div>
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
