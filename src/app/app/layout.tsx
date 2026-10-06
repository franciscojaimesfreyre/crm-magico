import Link from "next/link";
import { Bell, LogOut, Menu, Sparkles } from "lucide-react";
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

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-slate-900 lg:flex print:hidden">
        <Link href="/app" className="flex items-center gap-2 border-b border-white/10 px-5 py-4 text-white">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-brand-600">
            <Sparkles className="size-4" />
          </span>
          <span className="font-semibold">CRM Mágico</span>
        </Link>
        <Nav unreadMessages={unreadMessages} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 print:hidden items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <details className="relative lg:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-brand-600">
                <Menu className="size-5" />
              </summary>
              <div className="absolute top-8 left-0 z-30 flex max-h-[80vh] w-64 flex-col overflow-y-auto rounded-xl bg-slate-900 shadow-xl">
                <Nav unreadMessages={unreadMessages} />
              </div>
            </details>
            {user.organization.name}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/app/notificaciones" className="relative text-slate-500 hover:text-slate-800" title="Notificaciones">
              <Bell className="size-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1.5 -right-1.5 rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {unreadNotifications}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-2">
              <Avatar name={user.name} />
              <span className="hidden text-sm text-slate-700 sm:inline">{user.name}</span>
            </div>
            <form action={logout}>
              <button className="text-slate-400 hover:text-slate-700" title="Salir">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
