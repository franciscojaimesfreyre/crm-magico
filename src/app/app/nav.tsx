"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileSignature,
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  Mail,
  MessageCircle,
  PieChart,
  Settings,
  Sparkles,
  Users,
  UsersRound,
  Workflow,
} from "lucide-react";

const SECTIONS = [
  {
    title: null,
    items: [
      { href: "/app", label: "Inicio", icon: LayoutDashboard, exact: true },
      { href: "/app/clientes", label: "Clientes", icon: Users },
      { href: "/app/viajes", label: "Viajes", icon: Briefcase },
      { href: "/app/grupos", label: "Grupos", icon: UsersRound },
      { href: "/app/calendario", label: "Calendario", icon: CalendarDays },
      { href: "/app/tareas", label: "Tareas", icon: CheckSquare },
      { href: "/app/mensajes", label: "Mensajes", icon: MessageCircle, badgeKey: "messages" as const },
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
      { href: "/app/novedades", label: "Novedades e IA", icon: Sparkles },
      { href: "/app/documentos", label: "Documentos", icon: FolderOpen },
      { href: "/app/contratos", label: "Contratos", icon: FileSignature },
      { href: "/app/formularios", label: "Formularios", icon: ClipboardList },
      { href: "/app/automatizaciones", label: "Automatizaciones", icon: Workflow },
      { href: "/app/plantillas", label: "Plantillas de email", icon: Mail },
      { href: "/app/actividades", label: "Actividades", icon: BookOpen },
    ],
  },
];

export function Nav({ unreadMessages }: { unreadMessages: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {SECTIONS.map((section, i) => (
        <div key={i}>
          {section.title && (
            <p className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{section.title}</p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const badge = "badgeKey" in item && item.badgeKey === "messages" ? unreadMessages : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 && (
                      <span className="rounded-full bg-fuchsia-500 px-1.5 text-[11px] font-semibold text-white">{badge}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="mt-auto">
        <Link
          href="/app/configuracion"
          className={clsx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
            pathname.startsWith("/app/configuracion") ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
          )}
        >
          <Settings className="size-4" /> Configuración
        </Link>
      </div>
    </nav>
  );
}
