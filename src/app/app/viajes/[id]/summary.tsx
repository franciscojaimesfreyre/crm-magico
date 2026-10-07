import Link from "next/link";
import clsx from "clsx";
import { CalendarClock, Trash2, Utensils } from "lucide-react";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, Field, Input } from "@/components/ui";
import {
  COMMISSION_STATUS_COLOR,
  COMMISSION_STATUS_LABEL,
  DESTINATION_LABEL,
  ITEM_TYPE_LABEL,
  RESERVATION_STATUS_COLOR,
  RESERVATION_STATUS_LABEL,
} from "@/lib/labels";
import { ageOn, daysBetween, formatDate, formatRange, money, todayUTC, toDateInput } from "@/lib/format";
import { computeKeyDates } from "@/lib/key-dates";
import {
  addDiningReservation,
  deleteDiningReservation,
  setBookingTravelers,
} from "../actions";
import type { LoadedBooking } from "./data";

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
        {(b.notes || b.clientNotes) && (
          <div className="grid gap-4 border-t border-slate-100 p-5 text-sm sm:grid-cols-2">
            {b.notes && (
              <div>
                <p className="label">Notas internas</p>
                <p className="whitespace-pre-line text-slate-700">{b.notes}</p>
              </div>
            )}
            {b.clientNotes && (
              <div>
                <p className="label">Notas para el cliente</p>
                <p className="whitespace-pre-line text-slate-700">{b.clientNotes}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Fechas clave" description="Calculadas a partir de las fechas del viaje. Aparecen en el calendario y en el portal." />
        {keyDates.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Cargá las fechas del viaje para calcularlas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {keyDates.map((k) => {
              const diff = daysBetween(today, k.date);
              return (
                <li key={k.label} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
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
                        <span className="text-emerald-700">Pagado</span>
                      ) : i.balanceDue ? (
                        <span className={daysBetween(today, i.balanceDue) <= 14 ? "font-medium text-rose-600" : "text-slate-600"}>Saldo vence {formatDate(i.balanceDue)}</span>
                      ) : (
                        <span className="text-slate-400">Sin vencimiento</span>
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

      <Card className="xl:col-span-2">
        <CardHeader title="Reservas de restaurantes" description="Se muestran en el itinerario y la IA las respeta al planificar." />
        {b.diningReservations.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {b.diningReservations.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <Utensils className="size-4 text-amber-500" />
                  <div>
                    <p className="font-medium text-slate-800">{d.restaurant}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(d.dateTime)} · {d.dateTime.toISOString().slice(11, 16)} h{d.partySize ? ` · ${d.partySize} personas` : ""}
                      {d.confirmationNumber && ` · Conf. ${d.confirmationNumber}`}
                      {d.notes && ` · ${d.notes}`}
                    </p>
                  </div>
                </div>
                <form action={deleteDiningReservation.bind(null, d.id)}>
                  <ConfirmButton variant="ghost" message="¿Eliminar esta reserva de restaurante?">
                    <Trash2 className="size-3.5" />
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addDiningReservation.bind(null, b.id)} resetOnSuccess className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-6">
          <Field label="Restaurante" className="sm:col-span-2">
            <Input name="restaurant" required />
          </Field>
          <Field label="Fecha">
            <Input type="date" name="date" defaultValue={toDateInput(b.startDate)} required />
          </Field>
          <Field label="Hora">
            <Input type="time" name="time" defaultValue="12:00" />
          </Field>
          <Field label="Personas">
            <Input type="number" name="partySize" min={1} defaultValue={b.adults + b.children} />
          </Field>
          <Field label="Confirmación">
            <Input name="confirmationNumber" />
          </Field>
          <Field label="Notas" className="sm:col-span-5">
            <Input name="notes" placeholder="Pedidos especiales, cumpleaños, alergias…" />
          </Field>
          <div className="flex items-end">
            <SubmitButton size="sm" className="w-full">
              Agregar
            </SubmitButton>
          </div>
        </ActionForm>
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
