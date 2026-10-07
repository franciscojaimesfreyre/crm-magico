import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { toDateInput } from "@/lib/format";
import { CatalogForm } from "../catalog-form";
import { updateCatalogEntry } from "../actions";

export const metadata = { title: "Editar catálogo" };

export default async function EditCatalogEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user.isPlatformAdmin) notFound();
  const [e, areas] = await Promise.all([
    db.catalogEntry.findUnique({ where: { id } }),
    db.catalogEntry.findMany({ distinct: ["area"], select: { area: true }, orderBy: { area: "asc" } }),
  ]);
  if (!e) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={e.name} back={{ href: `/app/catalogo?destino=${e.destination}`, label: "Catálogo" }} />
      <CatalogForm
        action={updateCatalogEntry.bind(null, id)}
        areas={areas.map((a) => a.area)}
        submitLabel="Guardar"
        values={{
          kind: e.kind,
          destination: e.destination,
          area: e.area,
          name: e.name,
          minHeightIn: e.minHeightIn?.toString() ?? "",
          diningStyle: e.diningStyle ?? "",
          priceLevel: e.priceLevel?.toString() ?? "",
          notes: e.notes ?? "",
          closedFrom: toDateInput(e.closedFrom),
          closedTo: toDateInput(e.closedTo),
          mustDo: e.mustDo,
        }}
      />
    </div>
  );
}
