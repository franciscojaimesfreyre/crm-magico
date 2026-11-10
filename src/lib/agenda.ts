import "server-only";
import { db } from "@/lib/db";
import { computeKeyDates, type KeyDate } from "@/lib/key-dates";
import { addDays, money, todayUTC, toNumber } from "@/lib/format";
import type { BookingStatus, Destination, TaskPriority } from "@/generated/prisma/enums";
import { DESTINATION_LABEL } from "@/lib/labels";

/*
 * La agenda del agente: las fechas clave de los viajes y las tareas, con lo que hay que hacer y para quién.
 * La usan el calendario, el Inicio y el feed para Google/Apple, así que todos dicen lo mismo:
 * - lo vencido (saldos sin pagar, tareas atrasadas, ventanas que se abrieron y nadie marcó) se ve primero;
 * - lo que todavía no está reservado (consultas, cotizaciones, reservas por reservar) es tentativo y no alarma;
 * - las fechas que son acciones del agente (restaurantes, pases, check-in online) se pueden marcar hechas.
 */

/** Grupo de cada fecha, de más a menos importante: define el color y el orden dentro del día. */
export type AgendaKind = "payment" | "window" | "trip" | "logistics" | "task";
export const AGENDA_KINDS: { key: AgendaKind; label: string }[] = [
  { key: "payment", label: "Saldos" },
  { key: "window", label: "Ventanas" },
  { key: "trip", label: "Salidas y regresos" },
  { key: "logistics", label: "Durante el viaje" },
  { key: "task", label: "Tareas" },
];

export type AgendaEntry = {
  id: string;
  date: Date;
  kind: AgendaKind;
  sub: KeyDate["kind"] | "task";
  /** Corto, para el chip: "Saldar US$ 5.400", "Sale · R-0009". */
  short: string;
  /** Completo: "Saldar: Paquete Art of Animation". */
  label: string;
  hint?: string;
  /** Cliente completo y apellido (para el chip). */
  who: string;
  surname: string;
  booking?: { id: string; code: string; title: string; status: BookingStatus; agentId?: string | null };
  /** Vencido: saldo sin pagar o tarea atrasada. */
  overdue: boolean;
  /** Ventana que ya se abrió y nadie marcó hecha (el viaje todavía no empezó): no es urgente como un saldo. */
  open?: boolean;
  /** Lo que resta pagar, en los saldos. */
  amount?: number;
  currency?: string;
  tentative: boolean;
  /** Fechas que son acciones del agente: la clave para marcarlas hechas. */
  doneKey?: string;
  done: boolean;
  href: string;
  taskId?: string;
  priority?: TaskPriority;
};

/** Ventanas que el agente tiene que aprovechar: se marcan hechas cuando reservó o avisó. */
const ACTIONABLE: KeyDate["kind"][] = ["dining", "lightning", "checkin-online"];
/** El final de cada cosa: ya está en el viaje y llena el calendario sin pedir nada. */
const HIDDEN: KeyDate["kind"][] = ["stay-out", "dropoff"];
const TENTATIVE_TRIP: BookingStatus[] = ["INQUIRY", "QUOTED"];
/** Hasta cuándo para atrás se busca lo vencido. */
const OVERDUE_LOOKBACK_DAYS = 180;

const KIND_OF: Record<KeyDate["kind"], AgendaKind> = {
  payment: "payment",
  deposit: "payment",
  dining: "window",
  lightning: "window",
  "checkin-online": "window",
  checkin: "trip",
  checkout: "trip",
  "stay-in": "logistics",
  "stay-out": "logistics",
  pickup: "logistics",
  dropoff: "logistics",
  flight: "logistics",
  park: "logistics",
};

/** Importancia: la plata primero, restaurantes al final. */
export function rank(e: AgendaEntry) {
  if (e.kind === "payment") return e.overdue ? 0 : 1;
  if (e.kind === "task" && e.priority === "HIGH") return 2;
  if (e.sub === "lightning") return 3;
  if (e.sub === "checkin-online") return 4;
  if (e.kind === "trip") return 5;
  if (e.kind === "task") return 6;
  if (e.kind === "logistics") return 7;
  return 8;
}

export const sortAgenda = (a: AgendaEntry, b: AgendaEntry) => a.date.getTime() - b.date.getTime() || rank(a) - rank(b);

export const doneKeyOf = (k: KeyDate) => `${k.kind}:${k.date.toISOString().slice(0, 10)}:${k.itemId ?? ""}`;

function shortLabel(k: KeyDate, code: string, amount: string | null) {
  switch (k.kind) {
    case "checkin":
      return `Sale · ${code}`;
    case "checkout":
      return `Vuelve · ${code}`;
    case "payment":
      return amount ? `Saldar ${amount}` : "Saldar";
    case "dining":
      return "Restaurantes";
    case "lightning":
      return "Lightning Lane";
    case "checkin-online":
      return "Check-in online";
    case "flight":
      return "Vuelo";
    default:
      return k.label.split(":")[0];
  }
}

/** Quién ve qué: "mine" son lo propio y lo sin asignar; un id es un agente puntual; "all", todo el equipo. */
export type AgendaScope = "mine" | "all" | string;

type Options = {
  organizationId: string;
  userId: string;
  from: Date;
  to: Date;
  scope?: AgendaScope;
  /** Suma lo vencido de antes de `from` (para la agenda y el Inicio). */
  withOverdue?: boolean;
  kinds?: AgendaKind[];
  /** Nombre del cliente o código del viaje. */
  q?: string;
  /** Muestra también los fines (check-out, devolución, desembarque). */
  showEnds?: boolean;
  /** Muestra también lo ya marcado hecho (tachado). */
  showDone?: boolean;
};

export async function agenda({ organizationId, userId, from, to, scope = "all", withOverdue = false, kinds, q, showEnds = false, showDone = false }: Options): Promise<AgendaEntry[]> {
  const today = todayUTC();
  const since = withOverdue && from > addDays(today, -OVERDUE_LOOKBACK_DAYS) ? addDays(today, -OVERDUE_LOOKBACK_DAYS) : from;
  const agentWhere = scope === "all" ? {} : scope === "mine" ? { OR: [{ agentId: userId }, { agentId: null }] } : { agentId: scope };
  const assigneeWhere = scope === "all" ? {} : scope === "mine" ? { OR: [{ assigneeId: userId }, { assigneeId: null }] } : { assigneeId: scope };
  const search = q?.trim();
  // "Disney", "Universal", "crucero": también busca por destino.
  const destinations = search
    ? (Object.entries(DESTINATION_LABEL) as [Destination, string][]).filter(([, l]) => l.toLowerCase().includes(search.toLowerCase())).map(([d]) => d)
    : [];
  const clientWhere = search
    ? {
        OR: [
          { client: { firstName: { contains: search, mode: "insensitive" as const } } },
          { client: { lastName: { contains: search, mode: "insensitive" as const } } },
          { code: { contains: search, mode: "insensitive" as const } },
          { title: { contains: search, mode: "insensitive" as const } },
          ...(destinations.length ? [{ destination: { in: destinations } }] : []),
        ],
      }
    : {};
  const want = (k: AgendaKind) => !kinds || kinds.length === 0 || kinds.includes(k);
  const onlyTasks = kinds && kinds.length === 1 && kinds[0] === "task";

  const [bookings, tasks] = await Promise.all([
    onlyTasks
      ? Promise.resolve([])
      : db.booking.findMany({
          where: {
            organizationId,
            status: { not: "CANCELLED" },
            AND: [
              agentWhere,
              clientWhere,
              {
                // Las ventanas caen hasta 60 días antes del check-in: se buscan viajes de un margen amplio.
                OR: [
                  { startDate: { gte: addDays(since, -90), lte: addDays(to, 90) } },
                  { items: { some: { balanceDue: { gte: since, lte: to } } } },
                  { items: { some: { startDate: { gte: addDays(since, -90), lte: addDays(to, 90) } } } },
                ],
              },
            ],
          },
          include: {
            client: { select: { firstName: true, lastName: true } },
            items: true,
            flightLegs: true,
            keyDatesDone: { select: { key: true } },
          },
        }),
    want("task")
      ? db.task.findMany({
          where: {
            organizationId,
            completedAt: null,
            dueDate: { gte: withOverdue ? addDays(today, -3650) : from, lte: to },
            AND: [
              assigneeWhere,
              search
                ? {
                    OR: [
                      { title: { contains: search, mode: "insensitive" } },
                      { client: { firstName: { contains: search, mode: "insensitive" } } },
                      { client: { lastName: { contains: search, mode: "insensitive" } } },
                      { booking: { code: { contains: search, mode: "insensitive" } } },
                      { booking: { title: { contains: search, mode: "insensitive" } } },
                      ...(destinations.length ? [{ booking: { destination: { in: destinations } } }] : []),
                    ],
                  }
                : {},
            ],
          },
          include: {
            client: { select: { firstName: true, lastName: true } },
            booking: { select: { id: true, code: true, title: true, status: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const out: AgendaEntry[] = [];
  for (const b of bookings) {
    const who = `${b.client.firstName} ${b.client.lastName}`;
    const done = new Set(b.keyDatesDone.map((d) => d.key));
    const items = new Map(b.items.map((i) => [i.id, i]));
    const tripTentative = TENTATIVE_TRIP.includes(b.status);
    const tripStarted = !!b.startDate && b.startDate <= today;
    for (const k of computeKeyDates(b)) {
      const kind = KIND_OF[k.kind];
      if (!want(kind)) continue;
      if (!showEnds && HIDDEN.includes(k.kind)) continue;
      const tentative = tripTentative || !!k.tentative;
      // Lo que todavía no está reservado no abre ventanas: no hay restaurantes que reservar de un hotel cotizado.
      if (tentative && ACTIONABLE.includes(k.kind)) continue;
      const actionable = ACTIONABLE.includes(k.kind);
      const key = actionable ? doneKeyOf(k) : undefined;
      const isDone = !!key && done.has(key);
      if (isDone && !showDone) continue;
      const past = k.date < today;
      // Vencido: un saldo sin pagar. Abierta: una ventana que se abrió, nadie marcó y el viaje todavía no empezó.
      const overdue = past && !tentative && kind === "payment";
      const open = past && !tentative && !isDone && actionable && !tripStarted;
      const inRange = k.date >= from && k.date <= to;
      if (!inRange && !(withOverdue && (overdue || open))) continue;

      const item = k.itemId ? items.get(k.itemId) : undefined;
      const rest = item && k.kind === "payment" ? toNumber(item.price) - toNumber(item.paidAmount) : 0;
      const amount = rest > 0 ? money(rest, b.currency) : null;
      out.push({
        id: `${b.id}-${k.kind}-${k.label}`,
        date: k.date,
        kind,
        sub: k.kind,
        short: shortLabel(k, b.code, amount),
        label: k.label,
        hint: k.hint,
        who,
        surname: b.client.lastName || b.client.firstName,
        booking: { id: b.id, code: b.code, title: b.title, status: b.status, agentId: b.agentId },
        overdue,
        open,
        amount: rest > 0 ? rest : undefined,
        currency: b.currency,
        tentative,
        doneKey: key,
        done: isDone,
        href: k.itemId ? `/app/viajes/${b.id}?tab=reservas#reserva-${k.itemId}` : `/app/viajes/${b.id}`,
      });
    }
  }
  for (const t of tasks) out.push(taskEntry(t, today));
  return out.sort(sortAgenda);
}

/** Saldos de reservas confirmadas que ya vencieron sin pagar (el aviso rojo del menú). */
export function overdueBalancesCount(organizationId: string) {
  return db.bookingItem.count({
    where: {
      status: "CONFIRMED",
      balancePaidAt: null,
      balanceDue: { lt: todayUTC(), gte: addDays(todayUTC(), -OVERDUE_LOOKBACK_DAYS) },
      booking: { organizationId, status: { notIn: ["CANCELLED", "INQUIRY", "QUOTED"] } },
    },
  });
}

/** El alcance por defecto: lo propio si en la agencia hay más de un agente; si trabaja solo, da lo mismo. */
export async function defaultScope(organizationId: string): Promise<AgendaScope> {
  const users = await db.user.count({ where: { organizationId, active: true } });
  return users > 1 ? "mine" : "all";
}

/**
 * Avisa al agente cuando se abre una ventana para reservar (restaurantes, pases, check-in online) de un viaje
 * reservado. Una vez por fecha: si ya se avisó, no se repite. Corre con las automatizaciones por fecha.
 */
export async function notifyOpeningWindows(organizationId: string) {
  const today = todayUTC();
  const windows = await agenda({ organizationId, userId: "", from: addDays(today, -2), to: today, scope: "all", kinds: ["window"] });
  let sent = 0;
  for (const w of windows) {
    if (!w.booking || w.tentative) continue;
    const title = `${w.label} · ${w.who}`;
    const link = w.href;
    const already = await db.notification.findFirst({ where: { organizationId, title, link } });
    if (already) continue;
    await db.notification.create({
      data: { organizationId, userId: w.booking.agentId ?? null, title, body: [w.booking.code, w.hint].filter(Boolean).join(" · "), link },
    });
    sent++;
  }
  return sent;
}

type TaskInput = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: TaskPriority;
  bookingId: string | null;
  completedAt?: Date | null;
  client: { firstName: string; lastName: string } | null;
  booking: { id: string; code: string; title: string; status: BookingStatus } | null;
};

/** Una tarea como fila de la agenda. El chip lleva una versión corta, sin el nombre del cliente que ya va delante. */
export function taskEntry(t: TaskInput, today = todayUTC()): AgendaEntry {
  const who = t.client ? `${t.client.firstName} ${t.client.lastName}` : "";
  const surname = t.client ? t.client.lastName || t.client.firstName : "";
  return {
    id: t.id,
    date: t.dueDate ?? today,
    kind: "task",
    sub: "task",
    short: shortTask(t.title, t.client),
    label: t.title,
    hint: t.description?.split("\n")[0] ?? undefined,
    who,
    surname,
    booking: t.booking ?? undefined,
    overdue: !t.completedAt && !!t.dueDate && t.dueDate < today,
    tentative: false,
    done: !!t.completedAt,
    href: t.bookingId ? `/app/viajes/${t.bookingId}?tab=tareas` : "/app/tareas",
    taskId: t.id,
    priority: t.priority,
  };
}

/** "Armar cotización para Sofía Martínez (Walt Disney World)" → "Armar cotización". */
function shortTask(title: string, client: { firstName: string; lastName: string } | null) {
  let s = title.replace(/\s*\([^)]*\)/g, "").replace(/\s+—\s+.*$/, "");
  if (client) {
    for (const name of [`${client.firstName} ${client.lastName}`, client.lastName, client.firstName].filter((n) => n.length > 2)) {
      s = s.replace(new RegExp(`\\s*(para|de|a|con)?\\s*(los |la |el )?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"), "");
    }
  }
  s = s.replace(/[:\s,·-]+$/, "").trim();
  return s || title;
}
