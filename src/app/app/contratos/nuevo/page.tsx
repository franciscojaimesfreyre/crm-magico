import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Card, EmptyState, Field, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { createContract } from "../actions";

export const metadata = { title: "Nuevo contrato" };

export default async function NewContract({ searchParams }: { searchParams: Promise<{ bookingId?: string }> }) {
  const { bookingId } = await searchParams;
  const user = await requireUser();
  const [templates, bookings, clients] = await Promise.all([
    db.contractTemplate.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    db.booking.findMany({ where: { organizationId: user.organizationId, status: { not: "CANCELLED" } }, include: { client: true }, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ where: { organizationId: user.organizationId }, orderBy: { lastName: "asc" } }),
  ]);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Nuevo contrato" back={{ href: "/app/contratos", label: "Contratos" }} />
      {templates.length === 0 ? (
        <EmptyState title="Primero creá una plantilla" action={<LinkButton href="/app/contratos?tab=plantillas">Ir a plantillas</LinkButton>} />
      ) : (
        <Card className="p-5">
          <ActionForm action={createContract} className="space-y-4">
            <Field label="Plantilla">
              <Select name="templateId" options={templates.map((t) => ({ value: t.id, label: t.name }))} />
            </Field>
            <Field label="Viaje" hint="Completa los datos del viaje en el contrato">
              <Select
                name="bookingId"
                defaultValue={bookingId ?? ""}
                options={bookings.map((b) => ({ value: b.id, label: `${b.client.lastName}, ${b.client.firstName} — ${b.code} ${b.title}` }))}
                placeholder="Sin viaje"
              />
            </Field>
            <Field label="…o solo un cliente">
              <Select name="clientId" options={clients.map((c) => ({ value: c.id, label: `${c.lastName}, ${c.firstName}` }))} placeholder="—" />
            </Field>
            <Field label="Vence el (opcional)">
              <Input type="date" name="expiresAt" />
            </Field>
            <SubmitButton>Generar contrato</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
