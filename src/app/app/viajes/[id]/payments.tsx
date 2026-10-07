import clsx from "clsx";
import { CheckCircle2, Wallet, X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Input, buttonClass } from "@/components/ui";
import { daysBetween, formatDate, money, toDateInput, todayUTC } from "@/lib/format";
import { paymentProgress } from "@/lib/trips";
import { addReservationPayment, deleteReservationPayment, payReservationBalance } from "../actions";
import type { LoadedBooking } from "./data";

type Item = LoadedBooking["items"][number];

/**
 * Pagos de una reserva: el cliente le paga directo al proveedor el depósito y después
 * lo que quiera, siempre que quede saldada antes de la fecha límite.
 */
export function ReservationPayments({ item, currency }: { item: Item; currency: string }) {
  const p = paymentProgress(item);
  const today = todayUTC();
  const dueIn = item.balanceDue && !p.settled ? daysBetween(today, item.balanceDue) : null;
  const cancelled = item.status === "CANCELLED";
  if (p.price === 0 && item.payments.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-slate-700">
          Pagado <span className="font-semibold text-slate-900">{money(p.paid, currency)}</span> de {money(p.price, currency)}
          {!p.settled && p.price > 0 && (
            <>
              {" · "}Resta <span className="font-semibold text-slate-900">{money(p.remaining, currency)}</span>
            </>
          )}
        </p>
        {p.settled ? (
          <span className="flex items-center gap-1 font-medium text-emerald-700">
            <CheckCircle2 className="size-3.5" /> Saldada el {formatDate(item.balancePaidAt)}
          </span>
        ) : item.balanceDue ? (
          <span className={clsx(dueIn !== null && dueIn <= 14 ? "font-medium text-rose-600" : "text-slate-600")}>
            Saldar antes del {formatDate(item.balanceDue)}
            {dueIn !== null && (dueIn < 0 ? " (vencido)" : dueIn === 0 ? " (hoy)" : ` (en ${dueIn} días)`)}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={clsx("h-full rounded-full", p.settled ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${p.percent}%` }} />
      </div>
      {item.depositAmount !== null && !p.settled && (
        <p className={clsx("mt-1.5", p.depositCovered ? "text-emerald-700" : "text-amber-700")}>
          Depósito para reservar: {money(item.depositAmount, currency)} {p.depositCovered ? "· cubierto" : "· pendiente"}
        </p>
      )}

      {item.payments.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-200 border-t border-slate-200">
          {item.payments.map((pay) => (
            <li key={pay.id} className="flex items-center gap-3 py-1.5">
              <span className="w-28 whitespace-nowrap text-slate-500">{formatDate(pay.paidAt)}</span>
              <span className="font-medium text-slate-900">{money(pay.amount, currency)}</span>
              <span className="flex-1 truncate text-slate-500">{pay.note}</span>
              <form action={deleteReservationPayment.bind(null, pay.id)}>
                <button className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-rose-600" title="Eliminar pago" aria-label="Eliminar pago">
                  <X className="size-3.5" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {!cancelled && !p.settled && (
        <details className="mt-2">
          <summary className="cursor-pointer list-none font-medium text-brand-700">+ Registrar pago</summary>
          <ActionForm action={addReservationPayment.bind(null, item.id)} resetOnSuccess className="mt-2 flex flex-wrap items-end gap-2">
            <label className="w-32">
              <span className="label">Monto</span>
              <Input type="number" step="0.01" min={0.01} name="amount" required placeholder={p.remaining ? String(p.remaining) : undefined} />
            </label>
            <label className="w-40">
              <span className="label">Fecha</span>
              <Input type="date" name="paidAt" defaultValue={toDateInput(today)} />
            </label>
            <label className="min-w-40 flex-1">
              <span className="label">Nota</span>
              <Input name="note" placeholder="Ej: Depósito, cuota, tarjeta Visa…" />
            </label>
            <SubmitButton size="sm">Guardar pago</SubmitButton>
          </ActionForm>
          {p.remaining > 0 && (
            <form action={payReservationBalance.bind(null, item.id)} className="mt-2">
              <button className={buttonClass("secondary", "sm")}>
                <Wallet className="size-3.5" /> Pagó todo lo que falta ({money(p.remaining, currency)})
              </button>
            </form>
          )}
        </details>
      )}
    </div>
  );
}
