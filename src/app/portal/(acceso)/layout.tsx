import { MadeWithYiorno } from "@/components/brand";

export default function PortalAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ground)] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Lo ve el cliente final: el portal es de su agencia; Yiorno solo firma al pie. */}
        <h1 className="mb-6 text-center text-2xl text-slate-900">Tu portal de viajes</h1>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8 shadow-[var(--card-shadow)]">{children}</div>
        <div className="mt-6 flex justify-center">
          <MadeWithYiorno />
        </div>
      </div>
    </div>
  );
}
