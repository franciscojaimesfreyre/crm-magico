import Link from "next/link";
import clsx from "clsx";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, StatCard, StatStrip, Textarea } from "@/components/ui";
import {
  COMMISSION_STATUS_COLOR,
  COMMISSION_STATUS_LABEL,
  DESTINATION_LABEL,
  ITEM_TYPE_LABEL,
  RESERVATION_STATUS_COLOR,
  RESERVATION_STATUS_LABEL,
  urgencyTone,
} from "@/lib/labels";
import { ageOn, daysBetween, formatDate, formatRange, money, todayUTC } from "@/lib/format";
import { computeKeyDates } from "@/lib/key-dates";
import { saveTripNotes, setBookingTravelers } from "../actions";
import type { LoadedBooking } from "./data";
import { TripFlights } from "./flights";
import { TripAlerts } from "./trip-alerts";
import type { TripAlert } from "@/lib/knowledge-alerts";
import { TravelerAvatar } from "@/components/traveler-avatar";
import { resolveAvatar, type AvatarImageOption } from "@/lib/avatars";

export function Summary({ booking: b, alerts, gallery = [] }: { booking: LoadedBooking; alerts: TripAlert[] | null; gallery?: AvatarImageOption[] }) {
  const today = todayUTC();
  const keyDates = computeKeyDates(b);
  const upcomingDates = keyDates.filter((k) => k.date >= today);
  const pastDates = keyDates.filter((k) => k.date < today);
  const selected = new Set(b.travelers.map((t) => t.travelerId));
  // Lo que el cliente todavía les debe a los proveedores, y el próximo saldo que vence.
  const active = b.items.filter((i) => i.status !== "CANCELLED");
  const owed = active.filter((i) => !i.balancePaidAt).reduce((sum, i) => sum + Math.max(0, Number(i.price) - Number(i.paidAmount)), 0);
  const nextBalance = active
    .filter((i) => !i.balancePaidAt && i.balanceDue)
    .sort((x, y) => x.balanceDue!.getTime() - y.balanceDue!.getTime())[0];
  const nextBalanceDays = nextBalance ? daysBetween(today, nextBalance.balanceDue!) : null;

  return (
    <div className="space-y-6">
      {/* Primero, la plata del viaje en cifras: lo que se lee de un vistazo. */}
      {b.items.length > 0 && (
        <StatStrip>
          <StatCard label="Total del viaje" value={money(b.totalPrice, b.currency)} hint={`${active.length} ${active.length === 1 ? "reserva" : "reservas"}`} />
          <StatCard
            label="Saldo del cliente"
            value={money(owed, b.currency)}
            tone={owed > 0 ? "warn" : "good"}
            hint={owed > 0 ? "Le falta pagar a los proveedores" : "Todo pagado"}
          />
          <StatCard
            label="Próximo vencimiento"
            value={nextBalance ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(nextBalance.balanceDue!).replace(".", "") : "—"}
            tone={nextBalanceDays === null ? "default" : nextBalanceDays < 0 ? "bad" : nextBalanceDays <= 14 ? "warn" : "info"}
            hint={nextBalance ? `${nextBalanceDays! < 0 ? `Venció hace ${-nextBalanceDays!} días` : urgencyTone(nextBalanceDays!).label} · ${nextBalance.description}` : "Sin saldos pendientes"}
          />
          <StatCard label="Tu comisión" value={money(b.commissionAmount, b.currency)} tone="good" hint={b.organization.agency ? `La paga ${b.organization.agency.name}` : undefined} />
        </StatStrip>
      )}

      {alerts && <TripAlerts alerts={alerts} />}

      <Card>
        <CardHeader
          title="Reservas, pagos y comisiones"
          description="El cliente le paga directo a cada proveedor; acá llevás el seguimiento."
          actions={
            <Link href={`/app/viajes/${b.id}?tab=reservas`} className="text-sm font-semibold text-brand-700 hover:underline">
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
            <table className="min-w-full text-sm">
              <tbody className="divide-y divide-[var(--rule)]">
                {b.items.map((i) => {
                  const due = i.balanceDue && !i.balancePaidAt ? daysBetween(today, i.balanceDue) : null;
                  return (
                    <tr key={i.id} className={clsx(i.status === "CANCELLED" && "opacity-50")}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">{i.description}</p>
                        <p className="text-xs text-slate-500">{[ITEM_TYPE_LABEL[i.type], i.supplier, i.confirmationNumber && `Conf. ${i.confirmationNumber}`].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={RESERVATION_STATUS_COLOR[i.status]}>{RESERVATION_STATUS_LABEL[i.status]}</Badge>
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {i.balancePaidAt ? (
                          <Badge className="bg-emerald-50 text-emerald-800">Saldada</Badge>
                        ) : (
                          <>
                            <span className="text-slate-600">Pagado {money(i.paidAmount, b.currency)}</span>
                            {i.balanceDue && due !== null && (
                              <span className={clsx("mt-0.5 block w-fit rounded-full px-2 py-0.5 font-semibold", due < 0 ? "bg-rose-50 text-rose-700" : urgencyTone(due).soft, due >= 0 && urgencyTone(due).ink)}>
                                Saldar antes del {formatDate(i.balanceDue, { year: undefined })}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">{money(i.price, b.currency)}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <span className="font-semibold text-brand-700 tabular-nums">{money(i.commissionAmount, b.currency)}</span>{" "}
                        <Badge className={COMMISSION_STATUS_COLOR[i.commissionStatus]}>{COMMISSION_STATUS_LABEL[i.commissionStatus]}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Dos columnas que fluyen cada una por su lado: lo que pasa y quiénes viajan; el detalle y los vuelos. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Fechas clave" description="Salen de las reservas y los vuelos. Aparecen en el calendario y en el portal." />
            {keyDates.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Se calculan a partir de las reservas: cargá sus fechas (check-in, retiro del auto, vuelo…) y la fecha límite de pago.</p>
            ) : (
              <>
                <ul className="space-y-1 p-2">
                  {upcomingDates.map((k, idx) => {
                    const t = urgencyTone(daysBetween(today, k.date));
                    return (
                      <li key={idx} className="flex items-center gap-4 rounded-xl px-3 py-2.5">
                        <span className={clsx("flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5", t.soft, t.ink)}>
                          <span className="text-[11px] font-semibold tracking-[0.06em] uppercase opacity-80">{formatDate(k.date, { month: "short", day: undefined, year: undefined }).replace(".", "")}</span>
                          <span className="figure text-xl leading-none">{k.date.getUTCDate()}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{k.label}</p>
                          {k.hint && <p className="text-[13px] text-[var(--ink-soft)]">{k.hint}</p>}
                        </div>
                        <Badge className={clsx("shrink-0", t.soft, t.ink)}>{t.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
                {pastDates.length > 0 && (
                  <details className="group border-t border-[var(--rule)]">
                    <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-brand-700 hover:underline">
                      {pastDates.length} {pastDates.length === 1 ? "fecha pasada" : "fechas pasadas"}
                    </summary>
                    <ul className="px-5 pb-3">
                      {pastDates.map((k, idx) => (
                        <li key={idx} className="flex justify-between gap-3 py-1.5 text-sm text-slate-500">
                          <span>{k.label}</span>
                          <span className="shrink-0">{formatDate(k.date, { year: undefined })}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
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
                <ul className="space-y-2.5">
                  {b.client.travelers.map((t) => {
                    const age = ageOn(t.birthDate, b.startDate ?? undefined);
                    const name = `${t.firstName} ${t.lastName}`;
                    return (
                      <li key={t.id}>
                        <label className="flex items-center gap-3 text-sm">
                          <input type="checkbox" name="travelerIds" value={t.id} defaultChecked={selected.has(t.id)} className="size-4 rounded border-slate-300 accent-brand-600" />
                          <TravelerAvatar avatar={resolveAvatar(t.avatar, gallery)} name={name} size="xs" />
                          <span className="font-medium text-slate-800">{name}</span>
                          <span className="text-xs text-slate-500">{[age !== null && `${age} años al viajar`, t.heightCm && `${t.heightCm} cm`].filter(Boolean).join(" · ")}</span>
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
        </div>
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Detalle y notas" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-sm">
              <Item label="Destino" value={DESTINATION_LABEL[b.destination]} />
              <Item label="Fechas" value={formatRange(b.startDate, b.endDate)} />
              <Item label="Pasajeros" value={`${b.adults} adultos, ${b.children} menores`} />
              <Item label="Grupo" value={b.group ? <Link className="text-brand-700 hover:underline" href={`/app/grupos/${b.group.id}`}>{b.group.name}</Link> : "—"} />
            </dl>
            <ActionForm action={saveTripNotes.bind(null, b.id)} className="space-y-2 border-t border-[var(--rule)] p-5">
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
              <div className="border-t border-[var(--rule)] p-5 text-sm">
                <p className="label">Notas para el cliente</p>
                <p className="whitespace-pre-line text-slate-700">{b.clientNotes}</p>
              </div>
            )}
          </Card>
          <TripFlights booking={b} />
        </div>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}
