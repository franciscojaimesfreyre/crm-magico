"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  BookOpen,
  Briefcase,
  Castle,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileSignature,
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Newspaper,
  PieChart,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  Workflow,
} from "lucide-react";

type BadgeKey = "messages" | "notifications";

const SECTIONS = [
  {
    title: "Principal",
    items: [
      { href: "/app", label: "Inicio", icon: LayoutDashboard, exact: true },
      { href: "/app/clientes", label: "Clientes", icon: Users },
      { href: "/app/viajes", label: "Viajes", icon: Briefcase },
      { href: "/app/grupos", label: "Grupos", icon: UsersRound },
      { href: "/app/calendario", label: "Calendario", icon: CalendarDays },
      { href: "/app/tareas", label: "Tareas", icon: CheckSquare },
      { href: "/app/mensajes", label: "Mensajes", icon: MessageCircle, badgeKey: "messages" as BadgeKey },
    ],
  },
  {
    title: "Ventas",
    items: [
      { href: "/app/comisiones", label: "Comisiones", icon: FileSpreadsheet },
      { href: "/app/reportes", label: "Reportes", icon: PieChart },
    ],
  },
  {
    title: "Herramientas",
    items: [
      { href: "/app/novedades", label: "Novedades e IA", icon: Newspaper, admin: "Como admin general podés publicar y editar novedades globales" },
      { href: "/app/catalogo", label: "Catálogo de parques", icon: Castle, admin: "Como admin general podés cargar, editar y verificar el catálogo" },
      { href: "/app/documentos", label: "Documentos", icon: FolderOpen },
      { href: "/app/contratos", label: "Contratos", icon: FileSignature },
      { href: "/app/formularios", label: "Formularios", icon: ClipboardList },
      { href: "/app/automatizaciones", label: "Automatizaciones", icon: Workflow },
      { href: "/app/plantillas", label: "Plantillas de email", icon: Mail },
      { href: "/app/actividades", label: "Actividades", icon: BookOpen },
    ],
  },
];

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group flex h-10 items-center gap-2.5 rounded-xl px-2 text-sm transition-colors",
        active ? "bg-white font-semibold text-slate-900 shadow-[var(--card-shadow)]" : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Menú de la app. La fila activa lleva el tinte de la marca y su ícono el color pleno. Las opciones con
 * funciones de admin general llevan un escudo, solo para quien lo es; los contadores, solo en lo que
 * hay que atender (mensajes sin leer, notificaciones).
 */
export function Nav({
  unreadMessages,
  unreadNotifications = 0,
  isPlatformAdmin = false,
}: {
  unreadMessages: number;
  unreadNotifications?: number;
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const counts: Record<BadgeKey, number> = { messages: unreadMessages, notifications: unreadNotifications };
  return (
    <nav className="flex flex-col gap-5 py-1" aria-label="Principal">
      {SECTIONS.map((section, i) => (
        <div key={i}>
          {section.title && <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--ink-soft)] uppercase">{section.title}</p>}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const badge = "badgeKey" in item && item.badgeKey ? counts[item.badgeKey] : 0;
              const adminHint = isPlatformAdmin && "admin" in item ? item.admin : null;
              return (
                <li key={item.href}>
                  <NavLink href={item.href} active={active}>
                    {/* El ícono del activo va en un cuadrito neutro, como en la referencia. */}
                    <span className={clsx("grid size-7 shrink-0 place-items-center rounded-lg", active ? "bg-brand-100 text-brand-700" : "text-slate-500 group-hover:text-slate-700")}>
                      <item.icon className="size-4" strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {adminHint && (
                      <span title={adminHint} aria-label={adminHint} className="text-amber-700">
                        <ShieldCheck className="size-3.5" />
                      </span>
                    )}
                    {badge > 0 && (
                      <span className="min-w-5 rounded-full bg-rose-600 px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular-nums">{badge}</span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div>
        <NavLink href="/app/configuracion" active={pathname.startsWith("/app/configuracion")}>
          <span className={clsx("grid size-7 shrink-0 place-items-center rounded-lg", pathname.startsWith("/app/configuracion") ? "bg-brand-100 text-brand-700" : "text-slate-500")}>
            <Settings className="size-4" strokeWidth={1.75} />
          </span>
          Configuración
        </NavLink>
      </div>
    </nav>
  );
}
