import type { ReactNode } from "react";

/** Marco de un formulario para el cliente: logo o nombre de la agencia, título, descripción y privacidad. */
export function FormShell({ org, title, description, children }: { org: { name: string; logoUrl: string | null }; title: string; description?: string | null; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--ground)] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 flex justify-center">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} className="h-10 w-auto" />
          ) : (
            <p className="text-lg font-semibold text-slate-800">{org.name}</p>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-7">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {description && <p className="mt-1.5 mb-6 text-[15px] text-slate-600">{description}</p>}
          {!description && <div className="mb-6" />}
          {children}
        </div>
        <p className="mt-4 px-2 text-center text-[13px] text-slate-500">
          Tus respuestas las ve solo {org.name} y se usan para organizar tu viaje. No las compartimos con nadie más.
        </p>
      </div>
    </div>
  );
}
