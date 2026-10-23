import Link from "next/link";
import clsx from "clsx";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { SelectField } from "@/components/select-field";

// Componentes de presentación sin estado: se pueden usar en server y client components.

type Variant = "primary" | "secondary" | "ghost" | "danger" | "magic";

// Botones en píldora: el principal en el turquesa de la marca; el secundario blanco con borde; el resto, texto. Las
// acciones de IA ("magic") van en el turquesa pálido de los datos, nunca con degradado.
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
  secondary: "bg-white text-slate-800 border border-[var(--control)] hover:bg-[var(--raised)] active:bg-[var(--border)]",
  ghost: "text-slate-700 hover:bg-[var(--raised)] active:bg-[var(--border)]",
  danger: "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50",
  magic: "bg-data-50 text-data-700 hover:bg-data-100 active:bg-data-100",
};

const SIZES = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4.5 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZES = "md", className?: string) {
  // cn (tailwind-merge): las clases que se pasan ganan sobre las de la variante.
  return cn(
    "t-press inline-flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-2xl border border-[var(--border)] bg-white shadow-[var(--card-shadow)]", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-wrap items-start justify-between gap-3 border-b border-[var(--rule)] px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-slate-900">
          <ChevronLeft className="size-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-[1.15] text-slate-900">{title}</h1>
          {description && <div className="mt-2 max-w-3xl text-[15px] text-[var(--ink-soft)]">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex flex-none items-center rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold tracking-normal whitespace-nowrap", className ?? "bg-[var(--raised)] text-slate-700")}>
      {children}
    </span>
  );
}

/** Un monto con los decimales en gris ("US$ 8.825,00" → los ",00" más claros), como en la referencia. */
export function Amount({ value }: { value: string }) {
  const m = value.match(/^(.*?)([.,]\d{1,2})$/);
  if (!m) return <>{value}</>;
  return (
    <>
      {m[1]}
      <span className="figure-dec">{m[2]}</span>
    </>
  );
}

/** Una cifra con su etiqueta: una tarjeta propia, etiqueta en mayúsculas chicas, valor en bold. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "info";
}) {
  return (
    <Card className="min-w-0 p-5">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-[var(--ink-soft)] uppercase">{label}</p>
      <p
        className={clsx(
          "figure mt-2 text-[21px] leading-tight sm:text-[26px] xl:text-[30px]",
          tone === "good" && "text-data-700",
          tone === "warn" && "text-amber-800",
          tone === "bad" && "text-rose-700",
          tone === "info" && "text-sky-800",
          tone === "default" && "text-slate-900",
        )}
      >
        {typeof value === "string" ? <Amount value={value} /> : value}
      </p>
      {hint && <div className="mt-2 text-xs text-[var(--ink-soft)]">{hint}</div>}
    </Card>
  );
}

/** Fila de StatCards: tarjetas separadas, todas del mismo ancho; en el teléfono, de a dos. */
export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  const count = Array.isArray(children) ? children.filter(Boolean).length : 1;
  return (
    <div
      className={clsx(
        "grid grid-cols-2 gap-4",
        count === 3 && "sm:grid-cols-3",
        count === 4 && "lg:grid-cols-4",
        // Con cinco cifras las tarjetas son angostas: el número baja un tamaño para que entre entero.
        count >= 5 && "sm:grid-cols-3 xl:grid-cols-5 xl:[&_.figure]:text-[24px]",
        count % 2 === 1 && "max-sm:[&>*:last-child]:col-span-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--control)] bg-white px-6 py-12 text-center">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-[var(--ink-soft)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--ink-soft)]">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx("field", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx("field", className)} rows={3} {...props} />;
}

/** Select de la app: el menú propio (ver SelectField), con la misma interfaz de opciones de siempre. */
export function Select(props: Omit<ComponentProps<typeof SelectField>, "groups"> & { options: { value: string; label: string }[] }) {
  return <SelectField {...props} />;
}

/** Select con grupos de opciones. */
export function GroupedSelect(props: Omit<ComponentProps<typeof SelectField>, "options"> & { groups: { label: string; options: { value: string; label: string }[] }[] }) {
  return <SelectField {...props} />;
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="size-4 rounded border-[var(--control)] accent-brand-600" {...props} />
      {label}
    </label>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--rule)] text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={clsx("px-4 py-2.5 text-left text-xs font-normal whitespace-nowrap text-[var(--ink-soft)]", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={clsx("px-4 py-3 align-middle text-slate-700", className)}>
      {children}
    </td>
  );
}

/**
 * Tintes de identidad para las personas: cada nombre tiene siempre el mismo (pálido, con la tinta del
 * mismo tono). Es identidad, no dato: no se usa en gráficos ni en estados.
 */
const PERSON_TINTS = [
  "bg-[#fbe7f0] text-[#6b1d3e]", // frambuesa
  "bg-[#e3f1ec] text-[#1f4d3d]", // salvia
  "bg-[#fdeedd] text-[#7a3d0c]", // durazno
  "bg-[#e4eef8] text-[#1e3e63]", // celeste
  "bg-[#f1ecdf] text-[#584a24]", // arena
  "bg-[#e9f2df] text-[#3a5220]", // pistacho
];

export function personTint(name: string) {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSON_TINTS[h % PERSON_TINTS.length];
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className={clsx("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", personTint(name), className)} aria-hidden>
      {initials}
    </span>
  );
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; key: string; count?: number }[]; active: string }) {
  return (
    // La línea de base es una sombra interna (no un borde con las pestañas corridas 1 px): así no aparece
    // una barra de scroll vertical. En el teléfono se deslizan de costado, sin barra visible.
    <div className="mb-6 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={clsx(
            "border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
            t.key === active ? "border-slate-900 text-slate-900" : "border-transparent text-[var(--ink-soft)] hover:text-slate-900",
          )}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="ml-1.5 rounded-full bg-[var(--raised)] px-1.5 py-0.5 text-xs text-slate-700 tabular-nums">{t.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warn"; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-md border px-3 py-2 text-sm",
        tone === "info" && "border-sky-200 bg-sky-50 text-sky-800",
        tone === "error" && "border-rose-200 bg-rose-50 text-rose-800",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {children}
    </div>
  );
}
