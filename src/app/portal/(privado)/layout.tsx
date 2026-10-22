import Link from "next/link";
import { Bell, LogOut, MessageCircle, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { requireClientAccount } from "@/lib/auth";
import { logoutPortal } from "../actions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const account = await requireClientAccount();
  const org = account.client.organization;
  const [unreadNotifications, unreadMessages] = await Promise.all([
    db.notification.count({ where: { clientAccountId: account.id, readAt: null } }),
    db.message.count({ where: { clientId: account.clientId, senderType: { not: "CLIENT" }, readByClientAt: null } }),
  ]);
  return (
    <div className="min-h-screen bg-[var(--ground)]">
      {/* Barra clara con la marca de la agencia (su logo o su inicial en su color). */}
      <header className="sticky top-0 z-20 bg-[var(--ground)]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/portal" className="flex min-w-0 items-center gap-2.5 font-semibold text-slate-900">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt={org.name} className="h-8 w-auto" />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm text-white" style={{ backgroundColor: org.primaryColor }}>
                {org.name[0]}
              </span>
            )}
            <span className="truncate">{org.name}</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/portal/mensajes" className="relative grid size-10 place-items-center rounded-md text-slate-600 hover:bg-[var(--raised)] hover:text-slate-900" title="Mensajes">
              <MessageCircle className="size-5" />
              {unreadMessages > 0 && <Dot n={unreadMessages} />}
            </Link>
            <Link href="/portal/notificaciones" className="relative grid size-10 place-items-center rounded-md text-slate-600 hover:bg-[var(--raised)] hover:text-slate-900" title="Novedades">
              <Bell className="size-5" />
              {unreadNotifications > 0 && <Dot n={unreadNotifications} />}
            </Link>
            <Link href="/portal/perfil" className="grid size-10 place-items-center rounded-md text-slate-600 hover:bg-[var(--raised)] hover:text-slate-900" title="Mi familia y preferencias">
              <UserRound className="size-5" />
            </Link>
            <form action={logoutPortal}>
              <button className="grid size-10 place-items-center rounded-md text-slate-500 hover:bg-[var(--raised)] hover:text-slate-900" title="Salir" aria-label="Salir">
                <LogOut className="size-4" />
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      <footer className="pb-8 text-center text-xs text-[var(--ink-soft)]">
        {org.name}
        {org.contactPhone && ` · ${org.contactPhone}`}
        {org.contactEmail && ` · ${org.contactEmail}`}
      </footer>
    </div>
  );
}

function Dot({ n }: { n: number }) {
  return <span className="absolute top-1 right-0.5 min-w-4 rounded-full bg-brand-600 px-1 text-center text-[11px] leading-4 font-semibold text-white">{n}</span>;
}
