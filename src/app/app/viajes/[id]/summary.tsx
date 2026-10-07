import Link from "next/link";
import clsx from "clsx";
import { CalendarClock } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, Textarea } from "@/components/ui";
import {
  COMMISSION_STATUS_COLOR,
  COMMISSION_STATUS_LABEL,
  DESTINATION_LABEL,
  ITEM_TYPE_LABEL,
  RESERVATION_STATUS_COLOR,
  RESERVATION_STATUS_LABEL,
} from "@/lib/labels";
import { ageOn, daysBetween, formatDate, formatRange, money, todayUTC } from "@/lib/format";
import { computeKeyDates } from "@/lib/key-dates";
import { saveTripNotes, setBookingTravelers } from "../actions";
import type { LoadedBooking } from "./data";
import { TripFlights } from "./flights";

export function Summary({ booking: b }: { booking: LoadedBooking }) {
  const today = todayUTC();
  const keyDates = computeKeyDates(b);
  const selected = new Set(b.travelers.map((t) => t.travelerId));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Detalle del viaje" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-sm">
          <Item label="Destino" value={DESTINATION_LABEL[b.destination]} />
          <Item label="Fechas" value={formatRange(b.startDate, b.endDate)} />
          <Item label="Pasajeros" value={`${b.adults} adultos, ${b.children} menores`} />
          <Item label="Grupo" value={b.group ? <Link className="text-brand-700 hover:underline" href={`/app/grupos/${b.group.id}`}>{b.group.name}</Link> : "—"} />
        </dl>
        <ActionForm action={saveTripNotes.bind(null, b.id)} className="space-y-2 border-t border-slate-100 p-5">
          <div>
            <p className="text-sm font-medium text-slate-800">Notas</p>
            <p className="text-xs text-slate-500">Libres: pedidos del cliente, restaurantes reservados, ideas. La IA las usa para proponer el itinerario. El cliente no las ve.</p>
          </div>
          <Textarea
            key={b.notes ?? ""}
            name="notes"
            rows={8}
            defaultValue={b.notes ?? ""}
            placeholder={"Ej.: Cena en Be Our Guest el día 3 a las 19:30 (conf. 1234). Mía quiere conocer a las princesas. Prefieren descansar al mediodía."}
          />
          <div className="flex justify-end">
            <SubmitButton size="sm" variant="secondary">
              Guardar notas
            </SubmitButton>
          </div>
        </ActionForm>
        {b.clientNotes && (
          <div className="border-t border-slate-100 p-5 text-sm">
            <p className="label">Notas para el cliente</p>
            <p className="whitespace-pre-line text-slate-700">{b.clientNotes}</p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Fechas clave" description="Calculadas a partir de cada reserva (check-in del paquete, auto, saldos) y de los vuelos. Aparecen en el calendario y en el portal." />
        {keyDates.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Se calculan a partir de las reservas: cargá sus fechas (check-in, retiro del auto, vuelo…) y la fecha límite de pago.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {keyDates.map((k, idx) => {
              const diff = daysBetween(today, k.date);
              return (
                <li key={idx} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <CalendarClock className={clsx("size-4", diff < 0 ? "text-slate-300" : diff <= 7 ? "text-rose-500" : "text-brand-500")} />
                    <div>
                      <p className={clsx("font-medium", diff < 0 ? "text-slate-400" : "text-slate-800")}>{k.label}</p>
                      {k.hint && <p className="text-xs text-slate-400">{k.hint}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-700">{formatDate(k.date)}</p>
                    <p className={clsx("text-xs", diff < 0 ? "text-slate-400" : diff <= 7 ? "text-rose-600" : "text-slate-500")}>
                      {diff === 0 ? "Hoy" : diff > 0 ? `en ${diff} días` : `hace ${-diff} días`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Viajeros" description="Marcá quiénes viajan." />
        {b.client.travelers.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            El cliente no tiene viajeros cargados.{" "}
            <Link className="text-brand-700 hover:underline" href={`/app/clientes/${b.clientId}?tab=viajeros`}>
              Cargarlos
            </Link>
          </p>
        ) : (
          <form action={setBookingTravelers.bind(null, b.id)} className="p-5">
            <ul className="space-y-2">
              {b.client.travelers.map((t) => {
                const age = ageOn(t.birthDate, b.startDate ?? undefined);
                return (
                  <li key={t.id}>
                    <label className="flex items-center gap-3 text-sm">
                      <input type="checkbox" name="travelerIds" value={t.id} defaultChecked={selected.has(t.id)} className="size-4 rounded border-slate-300 text-brand-600" />
                      <span className="font-medium text-slate-800">
                        {t.firstName} {t.lastName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {[age !== null && `${age} años al viajar`, t.heightCm && `${t.heightCm} cm`].filter(Boolean).join(" · ")}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center justify-between">
              <Link className="text-xs text-brand-700 hover:underline" href={`/app/clientes/${b.clientId}?tab=viajeros`}>
                Editar viajeros del cliente
              </Link>
              <SubmitButton size="sm" variant="secondary">
                Guardar
              </SubmitButton>
            </div>
          </form>
        )}
      </Card>

      <TripFlights booking={b} />

      <Card className="xl:col-span-2">
        <CardHeader
          title="Reservas, pagos y comisiones"
          description={`${b.organization.agency ? `Comisiones: las paga ${b.organization.agency.name}. ` : ""}El cliente le paga directo a cada proveedor; acá llevás el seguimiento.`}
          actions={
            <Link href={`/app/viajes/${b.id}?tab=reservas`} className="text-xs font-medium text-brand-700 hover:underline">
              Gestionar reservas →
            </Link>
          }
        />
        {b.items.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            Todavía no hay reservas. Cargá el paquete, los tickets, el hotel o el auto en la pestaña{" "}
            <Link href={`/app/viajes/${b.id}?tab=reservas`} className="text-brand-700 hover:underline">
              Reservas
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <tbody className="divide-y divide-slate-100">
                {b.items.map((i) => (
                  <tr key={i.id} className={clsx(i.status === "CANCELLED" && "opacity-50")}>
                    <td className="px-5 py-2.5">
                      <p className="font-medium text-slate-800">{i.description}</p>
                      <p className="text-xs text-slate-500">{[ITEM_TYPE_LABEL[i.type], i.supplier, i.confirmationNumber && `Conf. ${i.confirmationNumber}`].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={RESERVATION_STATUS_COLOR[i.status]}>{RESERVATION_STATUS_LABEL[i.status]}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {i.balancePaidAt ? (
                        <span className="text-emerald-700">Saldada</span>
                      ) : (
                        <>
                          <span className="text-slate-600">Pagado {money(i.paidAmount, b.currency)}</span>
                          {i.balanceDue && (
                            <span className={clsx("block", daysBetween(today, i.balanceDue) <= 14 ? "font-medium text-rose-600" : "text-slate-500")}>
                              Saldar antes del {formatDate(i.balanceDue)}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{money(i.price, b.currency)}</td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      <span className="text-emerald-700">{money(i.commissionAmount, b.currency)}</span>{" "}
                      <Badge className={COMMISSION_STATUS_COLOR[i.commissionStatus]}>{COMMISSION_STATUS_LABEL[i.commissionStatus]}</Badge>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-medium">
                  <td className="px-5 py-2.5" colSpan={3}>
                    Total del viaje
                  </td>
                  <td className="px-3 py-2.5 text-right">{money(b.totalPrice, b.currency)}</td>
                  <td className="px-5 py-2.5 text-right text-emerald-700">{money(b.commissionAmount, b.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}
