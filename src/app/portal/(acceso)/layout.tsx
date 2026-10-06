import { Sparkles } from "lucide-react";

export default function PortalAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-fuchsia-100 via-brand-50 to-sky-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-brand-700">
          <Sparkles className="size-6" />
          <span className="text-xl font-semibold">Tu portal de viajes</span>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-xl">{children}</div>
      </div>
    </div>
  );
}
