import Link from "next/link";
import clsx from "clsx";
import { ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { CopyText } from "@/app/app/clientes/[id]/client-widgets";
import { AGENDA_KINDS, agenda, defaultScope, rank, taskEntry, type AgendaEntry, type AgendaKind } from "@/lib/agenda";
import { addDays, formatDate, todayUTC } from "@/lib/format";
import { appUrl } from "@/lib/app-url";
import { AgendaChip, AgendaRows, Legend, dotClass } from "./agenda-ui";

export const metadata = { title: "Calendario" };

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const VIEWS = [
  { key: "agenda", label: "Agenda" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
] as const;
type View = (typeof VIEWS)[number]["key"];

type Params = { vista?: string; mes?: string; semana?: string; dia?: string; de?: string; tipo?: string; q?: string };

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const parseDay = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);
const mondayOf = (d: Date) => addDays(d, -((d.getUTCDay() + 6) % 7));
const monthTitle = (d: Date) => new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
const dayTitle = (d: Date) => new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);

function groupByDay(entries: AgendaEntry[]) {
  const byDay = new Map<string, AgendaEntry[]>();
  for (const e of entries) byDay.set(ymd(e.date), [...(byDay.get(ymd(e.date)) ?? []), e]);
  return byDay;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayUTC();
  const view: View = VIEWS.some((v) => v.key === params.vista) ? (params.vista as View) : "agenda";
  const agents = await db.user.findMany({ where: { organizationId: user.organizationId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const scope = params.de ?? (await defaultScope(user.organizationId));
  const kinds = (params.tipo ?? "").split(",").filter((k): k is AgendaKind => AGENDA_KINDS.some((x) => x.key === k));
  const q = params.q?.trim() || undefined;

  /** Link a la misma página cambiando algunos parámetros (los vacíos se sacan). */
  const href = (next: Partial<Params>) => {
    const merged = { ...params, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return `/app/calendario${qs ? `?${qs}` : ""}`;
  };
  const base = { organizationId: user.organizationId, userId: user.id, scope, kinds, q };

  let body: React.ReactNode;
  let nav: React.ReactNode = null;

  if (view === "agenda") {
    // Al buscar se mira el próximo año: "Petrov" tiene que encontrar el viaje de marzo.
    const horizon = q ? 365 : 30;
    const [all, doneTasks] = await Promise.all([
      agenda({ ...base, from: today, to: addDays(today, horizon), withOverdue: true, showDone: true }),
      // Las tareas marcadas hoy, para poder deshacerlas sin ir a Tareas.
      !kinds.length || kinds.includes("task")
        ? db.task.findMany({
            where: {
              organizationId: user.organizationId,
              completedAt: { gte: today },
              ...(scope === "all" ? {} : scope === "mine" ? { OR: [{ assigneeId: user.id }, { assigneeId: null }] } : { assigneeId: scope }),
            },
            include: { client: { select: { firstName: true, lastName: true } }, booking: { select: { id: true, code: true, title: true, status: true } } },
          })
        : Promise.resolve([]),
    ]);
    const entries = all.filter((e) => !e.done);
    const done = [...all.filter((e) => e.done), ...doneTasks.map((t) => taskEntry(t, today))];
    const byImportance = (x: AgendaEntry, y: AgendaEntry) => rank(x) - rank(y) || x.date.getTime() - y.date.getTime();
    const upcoming = entries.filter((e) => !e.overdue && !e.open);
    const groups: { id: string; title: string; hint?: string; list: AgendaEntry[]; showDate?: boolean }[] = [
      { id: "vencido", title: "Vencido", list: entries.filter((e) => e.overdue).sort(byImportance) },
      { id: "abiertas", title: "Ventanas abiertas", hint: "Ya se puede reservar: marcalas hechas cuando esté listo.", list: entries.filter((e) => e.open) },
      { id: "hoy", title: "Hoy", list: upcoming.filter((e) => ymd(e.date) === ymd(today)), showDate: false },
      { id: "manana", title: "Mañana", list: upcoming.filter((e) => ymd(e.date) === ymd(addDays(today, 1))), showDate: false },
      { id: "semana", title: "Próximos 7 días", list: upcoming.filter((e) => e.date > addDays(today, 1) && e.date <= addDays(today, 7)) },
      { id: "proximos", title: q ? "Más adelante" : "De 8 a 30 días", list: upcoming.filter((e) => e.date > addDays(today, 7)) },
    ];
    const count = (id: string) => groups.find((g) => g.id === id)!.list.length;
    const counters = [
      { id: "vencido", label: "Vencido", n: count("vencido"), cls: "bg-rose-50 text-rose-800 ring-rose-200" },
      { id: "hoy", label: "Hoy", n: count("hoy"), cls: "bg-amber-50 text-amber-900 ring-amber-200" },
      { id: count("manana") > 0 ? "manana" : "semana", label: "7 días", n: count("manana") + count("semana"), cls: "bg-brand-50 text-brand-800 ring-brand-100" },
      { id: "proximos", label: q ? "Después" : "8 a 30 días", n: count("proximos"), cls: "bg-slate-50 text-slate-700 ring-slate-200" },
    ];
    body = (
      <>
        <div className="mb-5 grid grid-cols-4 gap-2 sm:gap-3">
          {counters.map((c) => (
            <a key={c.label} href={`#${c.id}`} className={clsx("rounded-2xl px-3 py-2.5 ring-1 sm:px-4 sm:py-3", c.n > 0 ? c.cls : "bg-white text-slate-500 ring-[var(--border)]")}>
              <span className="figure block text-xl leading-none sm:text-2xl">{c.n}</span>
              <span className="text-[12px] leading-tight font-medium sm:text-[13px]">{c.label}</span>
            </a>
          ))}
        </div>
        {q && <p className="mb-3 text-sm text-[var(--ink-soft)]">Buscando “{q}” en lo vencido y el próximo año.</p>}
        {entries.length === 0 ? (
          <Card className="p-6 text-sm text-[var(--ink-soft)]">
            Nada vencido ni {q ? "en el próximo año" : "en los próximos 30 días"}
            {q || kinds.length ? " con estos filtros" : ""}. Las fechas se calculan solas a partir de las reservas de cada viaje.
          </Card>
        ) : (
          <div className="space-y-5">
            {groups
              .filter((g) => g.list.length > 0)
              .map((g) => (
                <Card key={g.id} id={g.id} className={clsx("scroll-mt-6 p-2", g.id === "vencido" && "ring-1 ring-rose-200")}>
                  <h2 className={clsx("px-3 pt-2 text-[13px] font-semibold tracking-[0.06em] uppercase", g.id === "vencido" ? "text-rose-700" : g.id === "abiertas" ? "text-violet-800" : "text-[var(--ink-soft)]", !g.hint && "pb-1")}>
                    {g.title} · {g.list.length}
                  </h2>
                  {g.hint && <p className="px-3 pb-1 text-[13px] text-[var(--ink-soft)]">{g.hint}</p>}
                  <AgendaRows entries={g.list} showDate={g.showDate ?? true} />
                </Card>
              ))}
          </div>
        )}
        {done.length > 0 && (
          <details className="mt-5 rounded-2xl bg-white/60 p-2 ring-1 ring-[var(--border)]">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">Hechas ({done.length}): por si hay que deshacer alguna</summary>
            <AgendaRows entries={done} />
          </details>
        )}
      </>
    );
  } else if (view === "semana") {
    const start = mondayOf(parseDay(params.semana) ?? today);
    const end = addDays(start, 6);
    const entries = await agenda({ ...base, from: start, to: end });
    const byDay = groupByDay(entries);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    nav = (
      <Stepper
        prev={href({ semana: ymd(addDays(start, -7)) })}
        next={href({ semana: ymd(addDays(start, 7)) })}
        today={href({ semana: undefined })}
        title={`${formatDate(start, { year: undefined })} al ${formatDate(end, { year: undefined })}`}
      />
    );
    body = (
      <>
        <Card className="hidden overflow-hidden md:block">
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const list = byDay.get(ymd(d)) ?? [];
              const isToday = ymd(d) === ymd(today);
              return (
                <div key={ymd(d)} className="min-h-72 border-r border-slate-100 p-1.5 last:border-r-0">
                  <p className={clsx("mb-2 flex items-baseline justify-between px-1 text-xs", isToday ? "font-bold text-brand-700" : "text-slate-500")}>
                    <span>{WEEKDAYS[i]}</span>
                    <span className={clsx("tabular-nums", isToday && "rounded-full bg-brand-600 px-1.5 py-0.5 text-white")}>{d.getUTCDate()}</span>
                  </p>
                  <div className="space-y-1">
                    {list.map((e) => (
                      <AgendaChip key={e.id} entry={e} wrap />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <div className="space-y-4 md:hidden">
          {days.map((d) => {
            const list = byDay.get(ymd(d)) ?? [];
            if (list.length === 0) return null;
            return (
              <Card key={ymd(d)} className="p-2">
                <h2 className="px-3 pt-2 pb-1 text-sm font-semibold text-slate-900 first-letter:uppercase">{dayTitle(d)}</h2>
                <AgendaRows entries={list} showDate={false} />
              </Card>
            );
          })}
          {entries.length === 0 && <Card className="p-6 text-sm text-[var(--ink-soft)]">Nada esta semana.</Card>}
        </div>
      </>
    );
  } else {
    const [y, m] = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes.split("-").map(Number) : [today.getUTCFullYear(), today.getUTCMonth() + 1];
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last = new Date(Date.UTC(y, m, 0));
    // La grilla arranca el lunes anterior al día 1 y termina el domingo posterior al último día.
    const start = mondayOf(first);
    const end = addDays(last, 6 - ((last.getUTCDay() + 6) % 7));
    const entries = await agenda({ ...base, from: start, to: end, showDone: true });
    const byDay = groupByDay(entries);
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    const monthKey = (date: Date) => date.toISOString().slice(0, 7);
    // El día abierto: el elegido, o hoy si cae en este mes, o el primero con algo.
    const picked = parseDay(params.dia);
    const selected =
      picked && picked >= start && picked <= end ? picked
      : today >= first && today <= last ? today
      : (days.find((d) => d >= first && byDay.has(ymd(d))) ?? first);
    const dayList = byDay.get(ymd(selected)) ?? [];
    const dayHref = (d: Date) => `${href({ dia: ymd(d) })}#dia`;
    nav = <Stepper prev={href({ mes: monthKey(addDays(first, -1)), dia: undefined })} next={href({ mes: monthKey(addDays(last, 1)), dia: undefined })} today={href({ mes: undefined, dia: undefined })} title={monthTitle(first)} />;
    body = (
      <>
        {/* Escritorio: la grilla del mes, con el cliente primero en cada chip. */}
        <Card className="hidden overflow-hidden md:block">
          <div className="grid grid-cols-7 border-b border-[var(--border)] text-center text-xs font-medium text-[var(--ink-soft)]">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = ymd(d);
              const list = byDay.get(key) ?? [];
              const inMonth = d.getUTCMonth() === m - 1;
              const isToday = key === ymd(today);
              const isSelected = key === ymd(selected);
              return (
                <div key={key} className={clsx("min-h-28 border-r border-b border-slate-100 p-1.5", !inMonth && "bg-slate-50/60", isSelected && "bg-brand-50/50")}>
                  <Link href={dayHref(d)} className={clsx("mb-1 block text-right text-xs tabular-nums hover:underline", isToday ? "font-bold text-brand-700" : inMonth ? "text-slate-500" : "text-slate-300")} aria-label={`Ver el ${dayTitle(d)}`}>
                    {isToday ? <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-white">{d.getUTCDate()}</span> : d.getUTCDate()}
                  </Link>
                  <div className="space-y-1">
                    {list.slice(0, 4).map((e) => (
                      <AgendaChip key={e.id} entry={e} />
                    ))}
                    {list.length > 4 && (
                      <Link href={dayHref(d)} className="block px-1 text-xs font-medium text-brand-700 hover:underline">
                        +{list.length - 4} más
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        {/* Teléfono: el mes en puntos; tocar un día muestra su lista abajo. */}
        <Card className="p-2 md:hidden">
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-[var(--ink-soft)]">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d.slice(0, 2)}
              </div>
            ))}
            {days.map((d) => {
              const key = ymd(d);
              const list = byDay.get(key) ?? [];
              const inMonth = d.getUTCMonth() === m - 1;
              const isSelected = key === ymd(selected);
              const isToday = key === ymd(today);
              const dots = [...new Set(list.map((e) => dotClass(e)))].slice(0, 3);
              return (
                <Link
                  key={key}
                  href={dayHref(d)}
                  className={clsx(
                    "flex h-11 flex-col items-center justify-center gap-1 rounded-lg text-sm tabular-nums",
                    isSelected ? "bg-[var(--night)] text-[var(--ground)]" : isToday ? "font-bold text-brand-700" : inMonth ? "text-slate-800" : "text-slate-300",
                  )}
                >
                  {d.getUTCDate()}
                  <span className="flex h-1.5 gap-0.5">
                    {dots.map((cls) => (
                      <span key={cls} className={clsx("size-1.5 rounded-full", cls)} />
                    ))}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
        <Card id="dia" className="mt-5 scroll-mt-6 p-2">
          <h2 className="px-3 pt-2 pb-1 text-sm font-semibold text-slate-900 first-letter:uppercase">{dayTitle(selected)}</h2>
          {dayList.length === 0 ? <p className="px-3 pb-3 text-sm text-[var(--ink-soft)]">Nada este día.</p> : <AgendaRows entries={dayList} showDate={false} />}
        </Card>
      </>
    );
  }

  const icalUrl = `${appUrl()}/api/ical/${user.organization.icalToken}`;
  const pill = (active: boolean) =>
    clsx("rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors", active ? "bg-[var(--night)] text-[var(--ground)] ring-[var(--night)]" : "bg-white text-slate-700 ring-[var(--border)] hover:bg-[var(--raised)]");
  const toggleKind = (k: AgendaKind) => {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
    return href({ tipo: next.join(",") || undefined });
  };

  const scopeName = (id: string) => (id === "mine" ? "Míos" : id === "all" ? "Todo el equipo" : (agents.find((x) => x.id === id)?.name.split(" ")[0] ?? "Otro agente"));
  const scopeLabel = agents.length > 1 ? `De: ${scopeName(scope)}` : "";
  const activeFilters = kinds.length + (q ? 1 : 0);
  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      {agents.length > 1 && (
        // De quién: un menú, que escala con equipos grandes.
        <details className="relative">
          <summary className={clsx(pill(scope !== "mine"), "flex cursor-pointer list-none items-center gap-1")}>
            De: {scopeName(scope)} <ChevronDown className="size-3.5" />
          </summary>
          <div className="absolute z-20 mt-1 w-52 rounded-xl bg-white p-1 shadow-lg ring-1 ring-[var(--border)]">
            {[{ id: "mine", name: "Míos (y sin asignar)" }, { id: "all", name: "Todo el equipo" }, ...agents.filter((a) => a.id !== user.id)].map((a) => (
              <Link key={a.id} href={href({ de: a.id })} className={clsx("block rounded-lg px-3 py-2 text-sm hover:bg-[var(--raised)]", scope === a.id && "font-semibold text-brand-700")}>
                {a.name}
              </Link>
            ))}
          </div>
        </details>
      )}
      <span className="ml-1 text-[13px] text-[var(--ink-soft)]">Mostrar:</span>
      <Link href={href({ tipo: undefined })} className={pill(kinds.length === 0)}>
        Todas las fechas
      </Link>
      {AGENDA_KINDS.map((k) => (
        <Link key={k.key} href={toggleKind(k.key)} className={pill(kinds.includes(k.key))}>
          {k.label}
        </Link>
      ))}
      <form action="/app/calendario" className="ml-auto flex items-center gap-1 max-md:w-full">
        {Object.entries(params)
          .filter(([k, v]) => k !== "q" && v)
          .map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        <label className="flex h-9 items-center gap-2 rounded-full bg-white px-3 ring-1 ring-[var(--border)] max-md:flex-1">
          <Search className="size-4 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Cliente, viaje o destino" className="w-44 bg-transparent text-sm outline-none max-md:w-full" />
        </label>
        {q && (
          <Link href={href({ q: undefined })} className={buttonClass("ghost", "sm")}>
            Limpiar
          </Link>
        )}
      </form>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Lo que vence, lo que hay que reservar y quién viaja, con la acción para resolverlo."
        actions={
          <div className="flex rounded-full bg-white p-1 ring-1 ring-[var(--border)]" role="tablist" aria-label="Vista">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={href({ vista: v.key === "agenda" ? undefined : v.key, dia: undefined })}
                role="tab"
                aria-selected={view === v.key}
                className={clsx("rounded-full px-4 py-1.5 text-sm font-medium", view === v.key ? "bg-[var(--night)] text-[var(--ground)]" : "text-slate-600 hover:text-slate-900")}
              >
                {v.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* En escritorio los filtros quedan a la vista; en el teléfono, plegados para que lo primero sea la agenda. */}
      <div className="mb-5 hidden space-y-3 md:block">
        {filters}
        {view !== "agenda" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Legend />
            {nav}
          </div>
        )}
      </div>
      <div className="mb-4 space-y-3 md:hidden">
        <details className="rounded-2xl bg-white ring-1 ring-[var(--border)]">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-800">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4" /> Filtros{activeFilters > 0 ? ` (${activeFilters})` : ""}
            </span>
            <span className="text-[13px] text-[var(--ink-soft)]">{scopeLabel}</span>
          </summary>
          <div className="space-y-3 border-t border-[var(--border)] p-3">
            {filters}
            {view !== "agenda" && <Legend />}
          </div>
        </details>
        {nav}
      </div>

      {body}

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div className="min-w-0">
          <p className="font-medium text-slate-800">Sincronizá con Google, Apple u Outlook</p>
          <p className="text-xs text-slate-500">Suscribite a este link desde tu calendario (“Agregar calendario desde URL”). Es privado: no lo compartas.</p>
          <code className="mt-1 block text-xs break-all text-slate-700">{icalUrl}</code>
        </div>
        <CopyText text={icalUrl} label="Copiar link" />
      </Card>
    </>
  );
}

function Stepper({ prev, next, today, title }: { prev: string; next: string; today: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link href={prev} className={buttonClass("secondary", "sm")} aria-label="Anterior">
        <ChevronLeft className="size-4" />
      </Link>
      <span className="min-w-40 text-center font-medium text-slate-800 first-letter:uppercase">{title}</span>
      <Link href={next} className={buttonClass("secondary", "sm")} aria-label="Siguiente">
        <ChevronRight className="size-4" />
      </Link>
      <Link href={today} className={buttonClass("ghost", "sm")}>
        Hoy
      </Link>
    </div>
  );
}
