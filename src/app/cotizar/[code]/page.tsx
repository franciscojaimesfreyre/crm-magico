import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { DESTINATIONS } from "@/lib/labels";
import { submitLead } from "./actions";
import { TravelersInput } from "./travelers-input";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const org = await db.organization.findUnique({ where: { marketingCode: code } });
  return {
    title: org ? `Pedí tu cotización · ${org.name}` : "Cotización",
    description: org?.tagline ?? "Planificamos tu viaje a Disney y Universal",
  };
}

export default async function QuoteRequestPage({ params }: Props) {
  const { code } = await params;
  const org = await db.organization.findUnique({ where: { marketingCode: code } });
  if (!org) notFound();
  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-white to-sky-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 text-center">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} className="mx-auto mb-3 h-14 w-auto" />
          ) : (
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: org.primaryColor }}>
              <Sparkles className="size-6" />
            </span>
          )}
          <h1 className="text-2xl font-semibold text-slate-900">{org.name}</h1>
          {org.tagline && <p className="mt-1 text-slate-600">{org.tagline}</p>}
        </header>
        <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Pedí tu cotización sin cargo</h2>
          <p className="mb-5 text-sm text-slate-500">Contanos un poco de tu viaje soñado y te contactamos con una propuesta a medida.</p>
          <ActionForm action={submitLead.bind(null, code)} resetOnSuccess className="space-y-4">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre *">
                <Input name="firstName" autoComplete="given-name" required />
              </Field>
              <Field label="Apellido *">
                <Input name="lastName" autoComplete="family-name" required />
              </Field>
              <Field label="Email *">
                <Input name="email" type="email" autoComplete="email" required />
              </Field>
              <Field label="Teléfono / WhatsApp">
                <Input name="phone" type="tel" autoComplete="tel" />
              </Field>
            </div>
            <Field label="¿A dónde quieren ir?">
              <Select name="destination" options={DESTINATIONS} defaultValue="DISNEY_WORLD" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Desde (opcional)">
                <Input type="date" name="startDate" />
              </Field>
              <Field label="Hasta (opcional)">
                <Input type="date" name="endDate" />
              </Field>
            </div>
            <TravelersInput />
            <Field label="Pedidos especiales">
              <Textarea name="notes" rows={4} placeholder="Celebraciones, gustos de la familia, presupuesto aproximado…" />
            </Field>
            <SubmitButton className="w-full py-3" pendingText="Enviando…">
              Quiero mi cotización
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
