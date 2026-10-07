import Link from "next/link";
import clsx from "clsx";
import { Check, Star, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ConfirmButton } from "@/components/form-controls";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Select, buttonClass } from "@/components/ui";
import { CATALOG_KINDS, CATALOG_KIND_COLOR, CATALOG_KIND_LABEL, DESTINATIONS, DESTINATION_LABEL, DINING_STYLE_LABEL, priceSigns } from "@/lib/labels";
import { closedDuring, closureLabel, heightLabel, inchesToCm } from "@/lib/catalog";
import { formatDate, todayUTC } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";
import type { CatalogKind, Destination } from "@/generated/prisma/enums";
import { deleteCatalogEntry, markCatalogVerified, toggleCatalogMustDo } from "./actions";

export const metadata = { title: "Catálogo de parques" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string; tipo?: string; zona?: string; q?: string; estado?: string; altura?: string }>;
}) {
  const user = await requireUser();
  const f = await searchParams;
  const today = todayUTC();
  const destination = (f.destino || "DISNEY_WORLD") as Destination;
  const height = Number(f.altura) > 0 ? Math.round(Number(f.altura)) : null;

  const where: Prisma.CatalogEntryWhereInput = { destination };
  if (f.tipo) where.kind = f.tipo as CatalogKind;
  if (f.zona) where.area = f.zona;
  if (f.q) where.OR = [{ name: { contains: f.q, mode: "insensitive" } }, { notes: { contains: f.q, mode: "insensitive" } }];
  if (f.estado === "sin-revisar") where.verifiedAt = null;
  if (f.estado === "cerradas") where.closedFrom = { not: null };
  if (f.estado === "imperdibles") where.mustDo = true;

  const [entries, areas, counts] = await Promise.all([
    db.catalogEntry.findMany({ where, orderBy: [{ area: "asc" }, { kind: "asc" }, { name: "asc" }] }),
    db.catalogEntry.findMany({ where: { destination }, distinct: ["area"], select: { area: true }, orderBy: { area: "asc" } }),
    db.catalogEntry.groupBy({ by: ["destination"], _count: true }),
  ]);
  const byArea = new Map<string, typeof entries>();
  for (const e of entries) byArea.set(e.area, [...(byArea.get(e.area) ?? []), e]);
  const destinations = DESTINATIONS.filter((d) => counts.some((c) => c.destination === d.value) || d.value === destination).map((d) => ({
    ...d,
    label: `${d.label} (${counts.find((c) => c.destination === d.value)?._count ?? 0})`,
  }));
  const pending = entries.filter((e) => !e.verifiedAt).length;

  return (
    <>
      <PageHeader
        title="Catálogo de parques"
        description="Atracciones con su altura mínima, shows, restaurantes y shoppings que existen en cada destino. La IA arma los itinerarios solo con lo que figura acá, los imperdibles se suman siempre y el editor avisa a qué no llega cada chico."
        actions={user.isPlatformAdmin && <LinkButton href="/app/catalogo/nueva">Agregar</LinkButton>}
      />
      <form className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-7">
        <Select name="destino" defaultValue={destination} options={destinations} className="sm:col-span-2" />
        <Select name="tipo" defaultValue={f.tipo ?? ""} options={CATALOG_KINDS} placeholder="Todos los tipos" />
        <Select name="zona" defaultValue={f.zona ?? ""} options={areas.map((a) => ({ value: a.area, label: a.area }))} placeholder="Todas las zonas" />
        <input name="q" defaultValue={f.q} placeholder="Buscar…" className="field" />
        <Select
          name="estado"
          defaultValue={f.estado ?? ""}
          options={[
            { value: "sin-revisar", label: "Sin revisar" },
            { value: "cerradas", label: "Con cierre cargado" },
            { value: "imperdibles", label: "Imperdibles" },
          ]}
          placeholder="Todas"
        />
        <div className="flex gap-2">
          <input name="altura" type="number" min={50} max={250} defaultValue={f.altura} placeholder="Altura cm" title="Mostrá a qué no llega un chico de esta altura" className="field" />
          <button className={buttonClass("primary")}>Ver</button>
        </div>
      </form>
      {(user.isPlatformAdmin && pending > 0) || height ? (
        <p className="mb-4 text-sm text-slate-500">
          {height && `Con ${height} cm: las atracciones a las que no llega están marcadas en rojo. `}
          {user.isPlatformAdmin && pending > 0 && `${pending} sin revisar en esta vista: confirmalos contra la página oficial y marcalos con ✓.`}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          title="No hay nada cargado con estos filtros"
          description={user.isPlatformAdmin ? "Agregá atracciones, shows, restaurantes y shoppings de este destino." : "El equipo de la plataforma todavía no cargó este destino."}
          action={user.isPlatformAdmin && <LinkButton href="/app/catalogo/nueva">Agregar</LinkButton>}
        />
      ) : (
        <div className="space-y-6">
          {[...byArea.entries()].map(([area, list]) => (
            <Card key={area}>
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="font-semibold text-slate-900">{area}</h2>
                <p className="text-xs text-slate-500">{DESTINATION_LABEL[destination]} · {list.length}</p>
              </div>
              <ul className="divide-y divide-slate-100">
                {list.map((e) => {
                  const closedNow = closedDuring(e, today, today) || (e.closedFrom && e.closedFrom > today);
                  const tooShort = height && e.kind === "ATTRACTION" && e.minHeightIn && height < inchesToCm(e.minHeightIn);
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className={clsx("font-medium", closedNow ? "text-slate-400" : "text-slate-800")}>
                          {e.mustDo && <Star className="mr-1 inline size-3.5 fill-amber-400 text-amber-500" aria-label="Imperdible" />}
                          {e.name}
                          {e.mustDo && <span className="ml-2 text-xs font-normal text-amber-700">Imperdible</span>}
                          {e.closedFrom && <span className="ml-2 text-xs font-normal text-rose-600">{closureLabel(e)}</span>}
                        </p>
                        {e.notes && <p className="text-xs text-slate-500">{e.notes}</p>}
                      </div>
                      <Badge className={CATALOG_KIND_COLOR[e.kind]}>{CATALOG_KIND_LABEL[e.kind]}</Badge>
                      <span className="w-40 text-xs text-slate-600">
                        {e.kind === "ATTRACTION" &&
                          (e.minHeightIn ? (
                            <span className={clsx(tooShort && "font-semibold text-rose-600")}>
                              {tooShort ? "No llega · " : "Mín. "}
                              {heightLabel(e.minHeightIn)}
                            </span>
                          ) : (
                            "Sin altura mínima"
                          ))}
                        {e.diningStyle && DINING_STYLE_LABEL[e.diningStyle]}
                        {e.priceLevel && <span className="ml-1 font-medium text-emerald-700">{priceSigns(e.priceLevel)}</span>}
                      </span>
                      <span className="w-28 text-xs">
                        {e.verifiedAt ? (
                          <span className="text-emerald-700" title="Revisado contra la fuente oficial">
                            Revisado {formatDate(e.verifiedAt)}
                          </span>
                        ) : (
                          <span className="text-amber-700">Sin revisar</span>
                        )}
                      </span>
                      {user.isPlatformAdmin && (
                        <span className="flex items-center gap-1">
                          {(e.kind === "ATTRACTION" || e.kind === "SHOW") && (
                            <form action={toggleCatalogMustDo.bind(null, e.id)}>
                              <button className={buttonClass("ghost", "sm")} title={e.mustDo ? "Quitar de imperdibles" : "Marcar como imperdible"}>
                                <Star className={clsx("size-3.5", e.mustDo ? "fill-amber-400 text-amber-500" : "text-slate-400")} />
                              </button>
                            </form>
                          )}
                          {!e.verifiedAt && (
                            <form action={markCatalogVerified.bind(null, e.id)}>
                              <button className={buttonClass("ghost", "sm")} title="Marcar como revisado">
                                <Check className="size-3.5" />
                              </button>
                            </form>
                          )}
                          <Link href={`/app/catalogo/${e.id}`} className="px-2 text-xs text-brand-700 hover:underline">
                            Editar
                          </Link>
                          <form action={deleteCatalogEntry.bind(null, e.id)}>
                            <ConfirmButton variant="ghost" message={`¿Eliminar ${e.name} del catálogo?`}>
                              <Trash2 className="size-3.5" />
                            </ConfirmButton>
                          </form>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
