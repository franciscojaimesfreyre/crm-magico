import Link from "next/link";
import clsx from "clsx";
import { Check, RotateCcw, Wallet } from "lucide-react";
import { Badge, buttonClass } from "@/components/ui";
import { toggleTask } from "@/app/app/tareas/actions";
import { daysBetween, formatDate, money, todayUTC } from "@/lib/format";
import { urgencyTone } from "@/lib/labels";
import type { AgendaEntry, AgendaKind } from "@/lib/agenda";
import { toggleKeyDateDone } from "./actions";

/*
 * Cómo se ve cada fecha. El color dice qué tan importante es: rojo lo vencido, ámbar fuerte los saldos,
 * violeta lo que hay que reservar, verde el viaje y gris las tareas. Lo tentativo (todavía no reservado) va
 * con borde punteado y sin relleno, y lo hecho, tachado.
 */
export const KIND_STYLE: Record<AgendaKind, string> = {
  payment: "bg-amber-300 text-amber-950",
  window: "bg-violet-100 text-violet-900",
  trip: "bg-brand-600 font-semibold text-white",
  logistics: "bg-brand-50 text-brand-800",
  task: "bg-slate-100 text-slate-700",
};
const OVERDUE = "bg-rose-600 font-semibold text-white";
const TENTATIVE = "border border-dashed border-slate-400 bg-white text-slate-600";

/** El punto de color de cada fecha (en filas y en el mes del teléfono): los tonos fuertes de cada grupo. */
const DOT: Record<AgendaKind, string> = {
  payment: "bg-amber-500",
  window: "bg-violet-500",
  trip: "bg-brand-600",
  logistics: "bg-brand-300",
  task: "bg-slate-400",
};
export function dotClass(e: Pick<AgendaEntry, "kind" | "overdue" | "tentative">) {
  return e.overdue ? "bg-rose-600" : e.tentative ? "border border-dashed border-slate-500 bg-white" : DOT[e.kind];
}

export function chipClass(e: Pick<AgendaEntry, "kind" | "overdue" | "tentative" | "done">) {
  return clsx(e.overdue ? OVERDUE : e.tentative ? TENTATIVE : KIND_STYLE[e.kind], e.done && "line-through opacity-60");
}

/** El texto del chip: el cliente primero, para que no se pierda al cortarse. */
export const chipText = (e: AgendaEntry) => (e.surname ? `${e.surname} · ${e.short}` : e.short);
const chipTitle = (e: AgendaEntry) =>
  [e.who, e.label, e.hint, e.booking && `${e.booking.code} · ${e.booking.title}`, e.overdue && "Vencido", e.tentative && "Tentativo: todavía no está reservado"]
    .filter(Boolean)
    .join("\n");

export function AgendaChip({ entry, href, wrap = false }: { entry: AgendaEntry; href?: string; wrap?: boolean }) {
  return (
    <Link
      href={href ?? entry.href}
      title={chipTitle(entry)}
      className={clsx("block rounded-md px-1.5 py-0.5 text-xs", wrap ? "leading-snug" : "truncate", chipClass(entry))}
    >
      {chipText(entry)}
    </Link>
  );
}

export function Legend() {
  const items: [string, string][] = [
    [OVERDUE, "Vencido"],
    [KIND_STYLE.payment, "Saldos"],
    [KIND_STYLE.window, "Ventanas de reserva"],
    [KIND_STYLE.trip, "Salidas y regresos"],
    [KIND_STYLE.logistics, "Durante el viaje"],
    [KIND_STYLE.task, "Tareas"],
    [TENTATIVE, "Tentativo (sin reservar)"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-slate-700" aria-label="Referencias">
      {items.map(([cls, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={clsx("size-3.5 rounded-[4px] ring-1 ring-black/15", cls)} />
          {label}
        </li>
      ))}
    </ul>
  );
}

/** La acción que corresponde a cada fecha, para resolverla sin buscar en el viaje. */
function EntryAction({ entry }: { entry: AgendaEntry }) {
  if (entry.taskId) {
    return (
      <form action={toggleTask.bind(null, entry.taskId)}>
        <button className={buttonClass(entry.done ? "ghost" : "secondary", "sm")}>
          {entry.done ? (
            <>
              <RotateCcw className="size-3.5" /> Deshacer
            </>
          ) : (
            <>
              <Check className="size-3.5" /> Hecha
            </>
          )}
        </button>
      </form>
    );
  }
  if (entry.kind === "payment" && !entry.tentative) {
    // Abre el formulario de pago de esa reserva, con lo que resta cargado.
    const itemId = entry.href.split("#reserva-")[1];
    return (
      <Link href={itemId ? entry.href.replace("#", `&pagar=${itemId}#`) : entry.href} className={buttonClass(entry.overdue ? "primary" : "secondary", "sm")}>
        <Wallet className="size-3.5" /> Registrar pago
      </Link>
    );
  }
  if (entry.doneKey && entry.booking) {
    return (
      <form action={toggleKeyDateDone.bind(null, entry.booking.id, entry.doneKey, `${entry.label} (${entry.who})`)}>
        <button className={buttonClass(entry.done ? "ghost" : "secondary", "sm")}>
          {entry.done ? (
            <>
              <RotateCcw className="size-3.5" /> Deshacer
            </>
          ) : (
            <>
              <Check className="size-3.5" /> Hecho
            </>
          )}
        </button>
      </form>
    );
  }
  return null;
}

/** Una fila de la agenda: cuándo, quién, qué hay que hacer, el detalle y la acción. */
export function AgendaRow({ entry, showDate = true }: { entry: AgendaEntry; showDate?: boolean }) {
  const today = todayUTC();
  const diff = daysBetween(today, entry.date);
  const tone = urgencyTone(diff);
  // En los saldos lo que resta va aparte (en la etiqueta), así que no se repite en el detalle.
  const hint = entry.kind === "payment" ? entry.hint?.replace(/^Resta [^·]+(· )?/, "") : entry.hint;
  const detail = [entry.booking && `${entry.booking.code} · ${entry.booking.title}`, hint].filter(Boolean).join(" · ");
  // Sin repetir el cliente cuando el título ya lo nombra ("Armar cotización para Sofía Martínez").
  const prefix = entry.who && !(entry.surname && entry.label.includes(entry.surname)) ? `${entry.who} · ` : "";
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-3 py-2.5 hover:bg-[var(--raised)] sm:flex-nowrap">
      {showDate && (
        <span className={clsx("flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5", entry.overdue ? "bg-rose-50 text-rose-700" : entry.open ? "bg-violet-50 text-violet-800" : clsx(tone.soft, tone.ink))}>
          <span className="text-[12px] font-semibold tracking-[0.06em] uppercase opacity-80">{formatDate(entry.date, { month: "short", day: undefined, year: undefined }).replace(".", "")}</span>
          <span className="figure text-xl leading-none">{entry.date.getUTCDate()}</span>
        </span>
      )}
      <span aria-hidden className={clsx("hidden size-2.5 shrink-0 rounded-full sm:block", dotClass(entry))} />
      <Link href={entry.href} className="min-w-0 flex-1 basis-48">
        <p className={clsx("text-sm font-semibold text-slate-900", entry.done && "text-slate-500 line-through")}>
          {prefix}
          {entry.label}
        </p>
        {detail && <p className="truncate text-[13px] text-[var(--ink-soft)]">{detail}</p>}
      </Link>
      <div className={clsx("flex flex-wrap items-center gap-2 max-sm:w-full sm:shrink-0 sm:flex-nowrap", showDate && "max-sm:pl-16")}>
        {entry.tentative && <Badge className="border border-dashed border-slate-400 bg-white text-slate-600">Tentativo</Badge>}
        {entry.amount !== undefined && entry.currency && (
          <Badge className={entry.overdue ? "bg-rose-600 text-white" : "bg-amber-100 text-amber-950"}>Resta {money(entry.amount, entry.currency)}</Badge>
        )}
        {entry.overdue ? (
          <Badge className="bg-rose-50 text-rose-700">Vencido · {formatDate(entry.date, { year: undefined })}</Badge>
        ) : entry.open ? (
          <Badge className="bg-violet-50 text-violet-800">Abierta desde el {formatDate(entry.date, { year: undefined })}</Badge>
        ) : (
          showDate && <Badge className={clsx(tone.soft, tone.ink)}>{tone.label}</Badge>
        )}
        <EntryAction entry={entry} />
      </div>
    </li>
  );
}

export function AgendaRows({ entries, showDate = true }: { entries: AgendaEntry[]; showDate?: boolean }) {
  return (
    <ul className="space-y-1">
      {entries.map((e) => (
        <AgendaRow key={e.id} entry={e} showDate={showDate} />
      ))}
    </ul>
  );
}
