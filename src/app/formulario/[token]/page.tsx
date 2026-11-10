import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/format";
import type { FormField, TravelerAnswer } from "@/lib/forms";
import { FormRenderer } from "@/components/form-renderer";
import { FormShell } from "@/components/form-shell";
import { submitFormRequest } from "./actions";
import { formLinkExpired } from "@/lib/form-answers";
import { MarkOpened } from "./mark-opened";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const r = await db.formRequest.findUnique({ where: { token }, include: { form: { select: { title: true } }, organization: { select: { name: true } } } });
  return { title: r ? `${r.form.title} · ${r.organization.name}` : "Formulario", robots: { index: false } };
}

/** Formulario pedido a un cliente puntual: link personal, con sus viajeros precargados. */
export default async function RequestedForm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await db.formRequest.findUnique({
    where: { token },
    include: { form: true, organization: true, client: { include: { travelers: { orderBy: { createdAt: "asc" } } } }, booking: { include: { travelers: true } } },
  });
  if (!request) notFound();
  const expired = request.status !== "ANSWERED" && formLinkExpired(request.sentAt);

  // Si es de un viaje, primero los que viajan; si no, todos los viajeros del cliente.
  const inTrip = new Set(request.booking?.travelers.map((t) => t.travelerId) ?? []);
  const known = request.client.travelers.filter((t) => inTrip.size === 0 || inTrip.has(t.id));
  const travelers: TravelerAnswer[] = known.map((t) => ({
    travelerId: t.id,
    firstName: t.firstName,
    lastName: t.lastName ?? undefined,
    birthDate: toDateInput(t.birthDate) || undefined,
    heightCm: t.heightCm ? String(t.heightCm) : undefined,
    passportExpiry: toDateInput(t.passportExpiry) || undefined,
    dietaryNotes: t.dietaryNotes ?? undefined,
    accessibilityNotes: t.accessibilityNotes ?? undefined,
  }));
  const description = [`Hola ${request.client.firstName}.`, request.form.description, request.booking ? `Es para tu viaje "${request.booking.title}".` : null].filter(Boolean).join(" ");
  return (
    <FormShell org={request.organization} title={request.form.title} description={description}>
      {request.status === "SENT" && !expired && <MarkOpened token={token} />}
      {expired ? (
        <p className="text-[15px] text-slate-600">Este link venció. Pedile uno nuevo a tu agente y lo completás en un momento.</p>
      ) : request.status === "ANSWERED" ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-12 text-emerald-600" />
          <p className="text-lg font-semibold text-slate-900">Ya lo respondiste. ¡Gracias!</p>
          <p className="mt-1 text-[15px] text-slate-600">Si querés cambiar algo, escribile a tu agente.</p>
        </div>
      ) : (
        <FormRenderer fields={request.form.fields as FormField[]} action={submitFormRequest.bind(null, token)} travelers={travelers} />
      )}
    </FormShell>
  );
}
