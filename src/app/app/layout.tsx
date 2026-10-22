import Link from "next/link";
import { Bell, LogOut, Mail, Search, ShieldCheck } from "lucide-react";
import { MobileMenu } from "./mobile-menu";
import { BrandMark } from "@/components/brand-mark";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar } from "@/components/ui";
import { logout } from "@/app/(auth)/actions";
import { Nav } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unreadNotifications, unreadMessages] = await Promise.all([
    db.notification.count({
      where: {
        organizationId: user.organizationId,
        clientAccountId: null,
        readAt: null,
        OR: [{ userId: user.id }, { userId: null }],
      },
    }),
    db.message.count({
      where: { client: { organizationId: user.organizationId }, senderType: "CLIENT", readByAgentAt: null },
    }),
  ]);

  const nav = <Nav unreadMessages={unreadMessages} isPlatformAdmin={user.isPlatformAdmin} />;
  const product = (
    <Link href="/app" className="flex items-center gap-2.5 rounded-xl px-3 py-2">
      <BrandMark className="size-7" />
      <span className="text-[15px] font-bold tracking-[-0.02em] text-slate-900">CRM Mágico</span>
    </Link>
  );
  const iconButton = "relative grid size-9 place-items-center rounded-full border border-[var(--border)] bg-white text-slate-600 hover:text-slate-900";
  const count = (n: number) =>
    n > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[11px] leading-4 font-semibold text-white">{n}</span>;
  const userChip = (
    <div className="flex items-center gap-2.5 rounded-full border border-[var(--border)] bg-white py-1 pr-4 pl-1">
      <Avatar name={user.name} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13px] font-semibold text-slate-900">{user.name}</p>
        {user.isPlatformAdmin ? (
          <p title="Administrás el catálogo de parques y las novedades globales de la plataforma" className="flex items-center gap-1 text-xs text-amber-800">
            <ShieldCheck className="size-3" /> Admin general
          </p>
        ) : (
          <p className="truncate text-xs text-[var(--ink-soft)]">{user.organization.name}</p>
        )}
      </div>
    </div>
  );
  const logoutButton = (
    <form action={logout}>
      <button className="flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-sm text-slate-600 hover:bg-white hover:text-slate-900">
        <LogOut className="size-4" strokeWidth={1.75} /> Salir
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-[var(--ground)] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* El marco: menú y barra superior sobre el crema, sin línea entre ellos. */}
      <aside className="sticky top-0 hidden h-screen flex-col px-3 pt-4 pb-3 lg:flex print:hidden">
        <div className="mb-4">{product}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
        <div className="pt-2">{logoutButton}</div>
      </aside>
      <div className="flex min-w-0 flex-col lg:min-h-screen lg:pr-2 lg:pb-2">
        {/* Escritorio: barra superior con el buscador de clientes centrado, tu usuario, mensajes y notificaciones. */}
        <header className="hidden h-16 shrink-0 items-center gap-4 lg:flex print:hidden">
          <form action="/app/clientes" className="relative mx-auto w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
            <input name="q" placeholder="Buscar clientes por nombre, email o teléfono" aria-label="Buscar clientes" className="h-10 w-full rounded-full border border-[var(--border)] bg-white pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none" />
          </form>
          <div className="flex shrink-0 items-center gap-2 pr-2">
            {userChip}
            <Link href="/app/mensajes" className={iconButton} aria-label="Mensajes">
              <Mail className="size-4" strokeWidth={1.75} />
              {count(unreadMessages)}
            </Link>
            <Link href="/app/notificaciones" className={iconButton} aria-label="Notificaciones">
              <Bell className="size-4" strokeWidth={1.75} />
              {count(unreadNotifications)}
            </Link>
          </div>
        </header>
        {/* Teléfono y tablet: barra con el menú en una hoja a pantalla completa. */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[var(--ground)] px-3 lg:hidden print:hidden">
          <MobileMenu>
            <div className="px-3 py-3">{product}</div>
            <div className="px-3">{nav}</div>
            <div className="mt-auto space-y-2 px-3 py-4">
              {userChip}
              {logoutButton}
            </div>
          </MobileMenu>
          <Link href="/app" className="flex items-center gap-2">
            <BrandMark className="size-7" />
            <span className="text-[15px] font-bold tracking-[-0.02em] text-slate-900">CRM Mágico</span>
          </Link>
          <Link href="/app/notificaciones" className={iconButton} aria-label="Notificaciones">
            <Bell className="size-4" strokeWidth={1.75} />
            {count(unreadNotifications)}
          </Link>
        </header>
        {/* La hoja: el trabajo, en blanco, con esquinas grandes y un borde fino, sin sombra. */}
        <main className="flex-1 border-[var(--border)] bg-[var(--sheet)] lg:rounded-[20px] lg:border print:border-0">
          <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
