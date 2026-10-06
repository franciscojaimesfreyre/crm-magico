// Formatos y fechas. Las columnas @db.Date llegan como medianoche UTC: siempre formatear en UTC.

type Numeric = number | string | { toString(): string } | null | undefined;

export function toNumber(value: Numeric): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

export function money(value: Numeric, currency = "USD") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

export function percent(value: Numeric) {
  return `${toNumber(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
}

export function formatDate(date: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  }).format(d);
}

export function formatDateLong(date: Date | null | undefined) {
  return formatDate(date, { weekday: "long", day: "numeric", month: "long", year: undefined });
}

/** Fecha y hora real (no columnas @db.Date): se muestra en hora local de Argentina. */
export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "America/Argentina/Buenos_Aires",
  }).format(d);
}

export function formatRange(start: Date | null | undefined, end: Date | null | undefined) {
  if (!start && !end) return "Fechas a definir";
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start ?? end);
}

/** "2026-10-05" → Date a medianoche UTC. Devuelve null si está vacío o es inválido. */
export function parseDateInput(value: FormDataEntryValue | null | undefined): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "2026-10-05" para inputs type=date. */
export function toDateInput(date: Date | null | undefined) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

/** Hoy a medianoche UTC (para comparar con columnas @db.Date). */
export function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function ageOn(birthDate: Date | null | undefined, on: Date = new Date()) {
  if (!birthDate) return null;
  let age = on.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = on.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

export function fullName(p: { firstName: string; lastName?: string | null }) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function fileSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
