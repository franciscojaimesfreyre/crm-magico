import Link from "next/link";
import { LogOut, Sparkles } from "lucide-react";
import { requireAgencyUser } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { logout } from "@/app/(auth)/actions";

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAgencyUser();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/agencia" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-brand-600 text-white">
                <Sparkles className="size-4" />
              </span>
              <span className="hidden truncate sm:inline">{user.agency.name}</span>
            </Link>
            <nav className="flex gap-4 text-sm font-medium text-slate-600">
              <Link href="/agencia" className="hover:text-brand-700">
                Resumen
              </Link>
              <Link href="/agencia/configuracion" className="hover:text-brand-700">
                Configuración
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={user.name} />
            <span className="hidden text-sm text-slate-700 md:inline">{user.name}</span>
            <form action={logout}>
              <button className="text-slate-400 hover:text-slate-700" title="Salir">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
