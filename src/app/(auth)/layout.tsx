import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-fuchsia-600 px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-white">
          <Sparkles className="size-6" />
          <span className="text-xl font-semibold">CRM Mágico</span>
        </Link>
        <div className="rounded-2xl bg-white p-8 shadow-2xl">{children}</div>
      </div>
    </div>
  );
}
