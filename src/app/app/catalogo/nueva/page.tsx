import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CatalogForm } from "../catalog-form";
import { createCatalogEntry } from "../actions";

export const metadata = { title: "Agregar al catálogo" };

export default async function NewCatalogEntry() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) notFound();
  const areas = await db.catalogEntry.findMany({ distinct: ["area"], select: { area: true }, orderBy: { area: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Agregar al catálogo" back={{ href: "/app/catalogo", label: "Catálogo" }} />
      <CatalogForm action={createCatalogEntry} areas={areas.map((a) => a.area)} submitLabel="Agregar" />
    </div>
  );
}
