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
    <div className="min-h-screen bg-[#faf8f5]">
      <header className="sticky top-0 z-20 text-white shadow-sm" style={{ backgroundColor: "#0f172a" }}>
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/portal" className="flex items-center gap-2 font-semibold">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt={org.name} className="h-8 w-auto" />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-lg text-sm" style={{ backgroundColor: org.primaryColor }}>
                {org.name[0]}
              </span>
            )}
            <span className="truncate">{org.name}</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/portal/mensajes" className="relative text-white/80 hover:text-white" title="Mensajes">
              <MessageCircle className="size-5" />
              {unreadMessages > 0 && <Dot n={unreadMessages} />}
            </Link>
            <Link href="/portal/notificaciones" className="relative text-white/80 hover:text-white" title="Novedades">
              <Bell className="size-5" />
              {unreadNotifications > 0 && <Dot n={unreadNotifications} />}
            </Link>
            <Link href="/portal/perfil" className="text-white/80 hover:text-white" title="Mi familia y preferencias">
              <UserRound className="size-5" />
            </Link>
            <form action={logoutPortal}>
              <button className="text-white/60 hover:text-white" title="Salir">
                <LogOut className="size-4" />
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      <footer className="pb-8 text-center text-xs text-slate-400">
        {org.name}
        {org.contactPhone && ` · ${org.contactPhone}`}
        {org.contactEmail && ` · ${org.contactEmail}`}
      </footer>
    </div>
  );
}

function Dot({ n }: { n: number }) {
  return <span className="absolute -top-1.5 -right-2 rounded-full bg-rose-500 px-1 text-[10px] font-semibold">{n}</span>;
}
