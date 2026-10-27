import Link from "next/link";
import { YornoLogo } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ground)] px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="Yorno" className="mx-auto mb-8 flex w-fit text-[var(--night)]">
          <YornoLogo className="h-11" title={null} />
        </Link>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8 shadow-[var(--card-shadow)]">{children}</div>
        <p className="mt-5 text-center text-[15px] text-slate-700">Cada día del viaje, en orden.</p>
      </div>
    </div>
  );
}
