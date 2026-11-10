import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, ChevronRight, FileSpreadsheet } from "lucide-react";
import { SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, LinkButton, StatCard, StatStrip } from "@/components/ui";
import { DESTINATION_LABEL } from "@/lib/labels";
import { daysBetween, formatDate, money, todayUTC } from "@/lib/format";
import { DEFAULT_PAYMENT_TERM_DAYS, commissionOverview, openStatements } from "@/lib/commissions";
import { createStatement } from "./actions";
import { SelectAll } from "./widgets";

type Row = Awaited<ReturnType<typeof commissionOverview>>["rows"][number];

/**
 * Seguimiento de las comisiones: lo que ya se puede pedir, lo que espera pago (y desde cuándo), cuándo se
 * va a cobrar y lo cobrado. Los totales no dependen de ningún filtro: ganado = cobrado + por cobrar.
 */
export async function CommissionsOverview({ organizationId, agency }: { organizationId: string; agency: { name: string; paymentTermDays: number | null } | null }) {
  const today = todayUTC();
  const [{ rows, totals }, statements] = await Promise.all([commissionOverview(organizationId), openStatements(organizationId)]);
  const term = agency?.paymentTermDays ?? DEFAULT_PAYMENT_TERM_DAYS;
  const ready = rows.filter((r) => r.stage === "ready");
  const upcoming = rows.filter((r) => r.stage === "upcoming");
  const paid = rows.filter((r) => r.stage === "paid").sort((a, b) => (b.item.commissionPaidAt?.getTime() ?? 0) - (a.item.commissionPaidAt?.getTime() ?? 0));
  const [mainCurrency, main] = [...totals.entries()].sort((a, b) => b[1].earned - a[1].earned)[0] ?? ["USD", { earned: 0, received: 0, owed: 0, ready: 0, waiting: 0 }];

  // Cuándo se espera cobrar: planillas enviadas (envío + plazo), lo listo para pedir (hoy + plazo) y lo que
  // todavía no terminó (fin del viaje + plazo). Por mes, en la moneda principal.
  const forecast = new Map<string, number>();
  const add = (date: Date, amount: number) => {
    const key = (date < today ? today : date).toISOString().slice(0, 7);
    forecast.set(key, (forecast.get(key) ?? 0) + amount);
  };
  // Reserva por reserva (así nada se cuenta dos veces aunque esté repetida en dos planillas).
  for (const r of rows) {
    if (r.currency !== mainCurrency || r.owed <= 0) continue;
    if (r.stage === "waiting" && r.statement?.sentAt) add(new Date(r.statement.sentAt.getTime() + term * 86400_000), r.owed);
    if (r.stage === "ready" || r.stage === "draft") add(new Date(today.getTime() + term * 86400_000), r.owed);
    if (r.stage === "upcoming" && r.item.booking.endDate) add(new Date(r.item.booking.endDate.getTime() + term * 86400_000), r.owed);
  }
  const months = [...forecast.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 4);
  const monthLabel = (key: string) => new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));

  return (
    <div className="space-y-6">
      <StatStrip>
        <StatCard label="Ganado (todas tus ventas)" value={money(main.earned, mainCurrency)} hint={`${rows.length} ${rows.length === 1 ? "reserva confirmada" : "reservas confirmadas"}`} />
        <StatCard label="Ya cobrado" value={money(main.received, mainCurrency)} tone="good" />
        <StatCard
          label="Por cobrar"
          value={money(main.owed, mainCurrency)}
          tone={main.owed > 0 ? "warn" : "default"}
          hint={`${money(main.ready, mainCurrency)} para presentar · ${money(main.waiting, mainCurrency)} en planillas`}
        />
      </StatStrip>
      {totals.size > 1 && (
        <p className="-mt-3 text-xs text-slate-500">
          Otras monedas:{" "}
          {[...totals.entries()]
            .filter(([c]) => c !== mainCurrency)
            .map(([c, t]) => `${money(t.earned, c)} ganado, ${money(t.owed, c)} por cobrar`)
            .join(" · ")}
        </p>
      )}

      <Card>
        <CardHeader
          title={`Planillas activas · ${statements.length}`}
          description={`Lo que ya reclamaste (o vas a reclamar) y falta cobrar. ${agency?.name ?? "La agencia"} suele pagar a los ${term} días.`}
          actions={
            <LinkButton href="/app/comisiones/planillas" variant="secondary" size="sm">
              Ver todas las planillas
            </LinkButton>
          }
        />
        {statements.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">No hay planillas esperando pago.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {statements.map((o) => (
              <li key={o.statement.id}>
                <Link href={`/app/comisiones/planillas/${o.statement.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-[var(--raised)]">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-medium text-slate-900">
                      {o.statement.agency?.name ?? "Sin agencia"} · {formatDate(o.statement.periodFrom, { year: undefined })} al {formatDate(o.statement.periodTo)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {o.count} {o.count === 1 ? "reserva" : "reservas"} · reclamado {money(o.expected, o.currency)}
                      {o.received > 0 && ` · cobrado ${money(o.received, o.currency)}`}
                    </p>
                    {o.repeated > 0 && (
                      <p className="text-xs font-medium text-rose-700">
                        {o.repeated === 1 ? "1 reserva también figura" : `${o.repeated} reservas también figuran`} en otra planilla. Conviene quitar{o.repeated === 1 ? "la" : "las"} de una de las dos para no reclamar{o.repeated === 1 ? "la" : "las"} dos veces.
                      </p>
                    )}
                  </div>
                  {o.days === null ? (
                    <Badge className="bg-amber-100 text-amber-900">Sin enviar</Badge>
                  ) : o.late ? (
                    <Badge className="bg-rose-600 text-white">
                      <AlertTriangle className="mr-1 inline size-3" />
                      {o.days} días sin pago
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-700">
                      Enviada hace {o.days} {o.days === 1 ? "día" : "días"}
                      {o.dueAt && ` · se espera el ${formatDate(o.dueAt, { year: undefined })}`}
                    </Badge>
                  )}
                  <span className="font-semibold text-amber-800 tabular-nums">{money(o.owed, o.currency)}</span>
                  <ChevronRight className="size-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={`Comisiones listas para presentar · ${ready.length}`}
          description={`Viajes que ya terminaron y todavía no están en ninguna planilla. Generá la planilla${agency ? ` para ${agency.name}` : ""} y mandala.`}
        />
        {ready.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">No hay comisiones para presentar ahora.</p>
        ) : (
          <SelectableRows rows={ready} today={today} checked submitLabel={`Generar planilla con las elegidas`} />
        )}
      </Card>

      {months.length > 0 && (
        <Card>
          <CardHeader title="Cuándo vas a cobrar" description={`Estimado con el plazo de pago de la agencia (${term} días desde que recibe la planilla o termina el viaje).`} />
          <ul className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">
            {months.map(([key, amount]) => (
              <li key={key} className="rounded-xl bg-[var(--raised)] px-4 py-3">
                <p className="text-xs text-slate-500 first-letter:uppercase">{monthLabel(key)}</p>
                <p className="figure text-lg text-slate-900">{money(amount, mainCurrency)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {upcoming.length > 0 && (
        <details className="rounded-2xl border border-[var(--border)] bg-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-800">
            Todavía no se pueden presentar · {upcoming.length} (el viaje no terminó) · {money(upcoming.filter((r) => r.currency === mainCurrency).reduce((t, r) => t + r.owed, 0), mainCurrency)}
          </summary>
          <p className="px-5 text-xs text-slate-500">Si tu agencia paga al vender y no después del viaje, podés incluirlas en una planilla igual.</p>
          <SelectableRows rows={upcoming} today={today} submitLabel="Generar planilla con las elegidas" />
        </details>
      )}

      {paid.length > 0 && (
        <details className="rounded-2xl border border-[var(--border)] bg-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-800">
            Cobradas · {paid.length} · {money(paid.filter((r) => r.currency === mainCurrency).reduce((t, r) => t + r.received, 0), mainCurrency)}
          </summary>
          <ul className="divide-y divide-slate-100 pb-2">
            {paid.slice(0, 30).map((r) => (
              <li key={r.item.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-slate-800">
                    {r.item.booking.client.firstName} {r.item.booking.client.lastName}
                  </span>
                  <span className="text-slate-500"> · {r.item.description}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {r.item.commissionPaidAt && `el ${formatDate(r.item.commissionPaidAt)} · `}
                  <span className="font-medium text-emerald-700">{money(r.received, r.currency)}</span>
                  {r.received + 0.005 < r.expected && <span className="text-amber-700"> (faltan {money(r.expected - r.received, r.currency)})</span>}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-sm">
        <Link href="/app/comisiones?vista=todas" className="font-medium text-brand-700 hover:underline">
          Ver el listado de todas las ventas, con filtros por período, estado y fecha
        </Link>
      </p>
    </div>
  );
}

/** Lista de ventas con casillas para armar una planilla. */
function SelectableRows({ rows, today, checked = false, submitLabel }: { rows: Row[]; today: Date; checked?: boolean; submitLabel: string }) {
  return (
    <form>
      <input type="hidden" name="returnTo" value="/app/comisiones" />
      <input type="hidden" name="base" value="viaje" />
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        <li className="flex items-center gap-3 bg-[var(--raised)] px-5 py-2 text-xs text-slate-500">
          <SelectAll defaultChecked={checked} /> Todas
        </li>
        {rows.map((r) => {
          const b = r.item.booking;
          const ago = b.endDate ? daysBetween(b.endDate, today) : null;
          return (
            <li key={r.item.id}>
              <label className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm hover:bg-[var(--raised)]">
                <input type="checkbox" name="itemIds" value={r.item.id} defaultChecked={checked} className="size-4 rounded border-slate-300" />
                <span className="min-w-0 flex-1 basis-56">
                  <span className="font-medium text-slate-900">
                    {b.client.firstName} {b.client.lastName}
                  </span>
                  <span className="text-slate-500">
                    {" "}
                    · {r.item.description} · {b.code} {DESTINATION_LABEL[b.destination]}
                  </span>
                </span>
                {ago !== null && (
                  <span className={clsx("text-xs", ago > 45 ? "font-medium text-rose-700" : "text-slate-500")}>
                    {ago >= 0 ? `volvió hace ${ago} ${ago === 1 ? "día" : "días"}` : `vuelve el ${formatDate(b.endDate, { year: undefined })}`}
                  </span>
                )}
                <span className="w-28 text-right font-semibold text-brand-700 tabular-nums">{money(r.owed, r.currency)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end border-t border-slate-100 px-5 py-3">
        <SubmitButton formAction={createStatement} pendingText="Generando…">
          <FileSpreadsheet className="size-4" /> {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
