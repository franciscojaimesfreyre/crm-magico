import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ground)] px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5 text-slate-900">
          <BrandMark className="size-9" />
          <span className="text-xl font-bold tracking-[-0.01em]">CRM Mágico</span>
        </Link>
        <div className="rounded-lg border border-[var(--border)] bg-white p-8">{children}</div>
        <p className="mt-4 text-center text-[13px] text-[var(--ink-soft)]">El CRM de los agentes de viajes a Disney y Universal.</p>
      </div>
    </div>
  );
}
