import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, StatCard, StatStrip, Textarea } from "@/components/ui";
import { DESTINATION_LABEL, urgencyTone } from "@/lib/labels";
import { ageOn, daysBetween, formatDate, formatRange, money, todayUTC } from "@/lib/format";
import { computeKeyDates } from "@/lib/key-dates";
import { expectsBalanceDue, myCommissionOf, orgSharePercent, travelerCountCheck } from "@/lib/trips";
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
  // Los marcados contra la cantidad cargada en el viaje (adultos y menores, por la edad al viajar).
  const countWarning = travelerCountCheck(
    b.adults,
    b.children,
    b.client.travelers.filter((t) => selected.has(t.id)).map((t) => ageOn(t.birthDate, b.startDate ?? undefined)),
  );
  // El total y la comisión del viaje (los mismos del listado) incluyen lo que falta reservar, que se detalla aparte;
  // el saldo del cliente cuenta solo lo reservado con el proveedor.
  const sum = (list: typeof b.items, pick: (i: (typeof b.items)[number]) => number) => list.reduce((t, i) => t + pick(i), 0);
  const reserved = b.items.filter((i) => i.status === "CONFIRMED");
  const pending = b.items.filter((i) => i.status === "PENDING");
  const reservedTotal = sum(reserved, (i) => Number(i.price));
  const pendingTotal = sum(pending, (i) => Number(i.price));
  const owed = sum(reserved, (i) => (i.balancePaidAt ? 0 : Math.max(0, Number(i.price) - Number(i.paidAmount))));
  // Tu parte de la comisión (la agencia host puede retener un %); la del proveedor se muestra chica.
  const pct = orgSharePercent(b.organization);
  const live = b.items.filter((i) => i.status !== "CANCELLED");
  const myCommission = sum(live, (i) => myCommissionOf(i, pct));
  const providerCommission = sum(live, (i) => Number(i.commissionAmount));
  const reservedCommission = sum(reserved, (i) => myCommissionOf(i, pct));
  const pendingCommission = sum(pending, (i) => myCommissionOf(i, pct));
  const unsettled = [...reserved, ...pending].filter((i) => !i.balancePaidAt && Number(i.price) > Number(i.paidAmount));
  const nextBalance = unsettled.filter((i) => i.balanceDue).sort((x, y) => x.balanceDue!.getTime() - y.balanceDue!.getTime())[0];
  const missingDue = unsettled.filter((i) => !i.balanceDue && expectsBalanceDue(i)).length;
  const nextBalanceDays = nextBalance ? daysBetween(today, nextBalance.balanceDue!) : null;

  return (
    <div className="space-y-6">
      {/* Primero, la plata del viaje en cifras: lo que se lee de un vistazo. Es el único lugar donde están. */}
      {b.items.length > 0 && (
        <StatStrip>
          <StatCard
            label="Total del viaje"
            value={money(b.totalPrice, b.currency)}
            hint={pendingTotal > 0 ? `${money(reservedTotal, b.currency)} reservado · ${money(pendingTotal, b.currency)} por reservar` : `${reserved.length} ${reserved.length === 1 ? "reserva" : "reservas"}`}
          />
          <StatCard
            label="Saldo del cliente"
            value={money(owed, b.currency)}
            tone={owed > 0 ? "warn" : reserved.length > 0 ? "good" : "default"}
            hint={owed > 0 ? "Le falta pagar de lo reservado" : reserved.length > 0 ? "Lo reservado está pagado" : "Cuando reserves, se cuenta acá"}
          />
          <StatCard
            label="Próximo vencimiento"
            value={nextBalance ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(nextBalance.balanceDue!).replace(".", "") : "—"}
            tone={nextBalanceDays === null ? (missingDue > 0 ? "warn" : "default") : nextBalanceDays < 0 ? "bad" : nextBalanceDays <= 14 ? "warn" : "info"}
            hint={
              nextBalance
                ? `${nextBalanceDays! < 0 ? `Venció hace ${-nextBalanceDays!} días` : urgencyTone(nextBalanceDays!).label} · ${nextBalance.description}`
                : missingDue > 0
                  ? `Falta la fecha de saldo en ${missingDue} ${missingDue === 1 ? "reserva" : "reservas"}${b.startDate ? "" : ": cargá las fechas del viaje"}`
                  : "Sin saldos pendientes"
            }
          />
          <StatCard
            label="Tu comisión"
            value={money(myCommission, b.currency)}
            tone="good"
            hint={
              [
                pendingCommission > 0 && `${money(reservedCommission, b.currency)} de lo reservado`,
                providerCommission > myCommission + 0.005 && `Proveedor ${money(providerCommission, b.currency)} · ${b.organization.agency?.name ?? "la agencia"} retiene ${money(providerCommission - myCommission, b.currency)}`,
                providerCommission <= myCommission + 0.005 && b.organization.agency && `La paga ${b.organization.agency.name}`,
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          />
        </StatStrip>
      )}

      {alerts && <TripAlerts alerts={alerts} />}

      <Link href={`/app/viajes/${b.id}?tab=${b.items.length > 0 ? "reservas" : "cotizaciones"}`} className="block">
        <Card className="flex items-center justify-between gap-4 px-5 py-4 transition hover:ring-brand-300">
          <div>
            <p className="font-semibold text-slate-900">Reservas</p>
            <p className="text-sm text-slate-600">
              {b.items.length === 0
                ? "Todavía no hay reservas. Llegan solas al aceptarse una cotización, o se cargan a mano."
                : [pending.length > 0 && `${pending.length} por reservar`, reserved.length > 0 && `${reserved.length} ${reserved.length === 1 ? "reservada" : "reservadas"}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span className="text-sm font-semibold whitespace-nowrap text-brand-700">{b.items.length > 0 ? "Gestionar reservas →" : "Armar cotización →"}</span>
        </Card>
      </Link>

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
                          <span className="text-[12px] font-semibold tracking-[0.06em] uppercase opacity-80">{formatDate(k.date, { month: "short", day: undefined, year: undefined }).replace(".", "")}</span>
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
            {countWarning && (
              <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  {countWarning}{" "}
                  <Link href={`/app/viajes/${b.id}/editar`} className="font-medium text-brand-700 hover:underline">
                    Cambiar la cantidad
                  </Link>
                </p>
              </div>
            )}
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
