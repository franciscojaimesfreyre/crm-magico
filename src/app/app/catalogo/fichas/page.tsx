import Link from "next/link";
import clsx from "clsx";
import { Clock, FerrisWheel, PartyPopper } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { DESTINATION_LABEL } from "@/lib/labels";
import { parseSchedule, parseSections, todayInOrlando } from "@/lib/park-sheet";
import { formatDate } from "@/lib/format";
import { CatalogTabs } from "../tabs";
import { loadDefaultGuides } from "./actions";
import { CatalogImportExport } from "../import-export";
import { HoursImport } from "./hours-import";

export const metadata = { title: "Fichas de parques" };

export default async function ParkGuidesPage() {
  const user = await requireUser();
  const today = todayInOrlando();
  const guides = await db.parkGuide.findMany({ orderBy: [{ destination: "asc" }, { kind: "asc" }, { position: "asc" }, { name: "asc" }] });
  const byDestination = new Map<string, typeof guides>();
  for (const g of guides) byDestination.set(g.destination, [...(byDestination.get(g.destination) ?? []), g]);

  return (
    <>
      <PageHeader
        title="Catálogo de parques"
        description="Cada parque y cada evento especial tiene su ficha: horarios, llegada recomendada, imperdibles, atracciones leves, shows, personajes, dónde comer, snacks y tips. Cuando se suma un parque al itinerario (a mano o con la IA) se copia su ficha, y el agente la puede editar para ese viaje. Si el viaje tiene un evento reservado, ese día aparece la ficha del evento."
        actions={
          <div className="flex flex-wrap items-start gap-2">
            <CatalogImportExport canImport={user.isPlatformAdmin} />
            {user.isPlatformAdmin && (
              <div className="flex flex-wrap gap-2">
                <form
                  action={async () => {
                    "use server";
                    await loadDefaultGuides();
                  }}
                >
                  <button className={buttonClass("secondary")}>Cargar fichas base</button>
                </form>
                <LinkButton href="/app/catalogo/fichas/nueva?tipo=EVENT" variant="secondary">
                  Nuevo evento
                </LinkButton>
                <LinkButton href="/app/catalogo/fichas/nueva">Nuevo parque</LinkButton>
              </div>
            )}
          </div>
        }
      />
      <CatalogTabs active="fichas" />
      {user.isPlatformAdmin && guides.length > 0 && (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          {(["disney", "universal"] as const).map((source) => (
            <HoursImport
              key={source}
              source={source}
              today={today}
              guides={guides.map((g) => ({ id: g.id, kind: g.kind, name: g.name, park: g.park, aliases: g.aliases, destination: g.destination }))}
            />
          ))}
        </div>
      )}

      {guides.length === 0 ? (
        <EmptyState
          title="Todavía no hay fichas"
          description={
            user.isPlatformAdmin
              ? "Cargá las fichas base (parques de Disney World y Universal Orlando, y las fiestas de Halloween y Navidad) y editalas, o creá una desde cero."
              : "El equipo de la plataforma todavía no cargó las fichas de los parques."
          }
        />
      ) : (
        <div className="space-y-6">
          {[...byDestination.entries()].map(([destination, list]) => (
            <section key={destination}>
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">{DESTINATION_LABEL[destination as keyof typeof DESTINATION_LABEL]}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((g) => {
                  const sections = parseSections(g.sections);
                  const items = sections.reduce((n, s) => n + s.items.length, 0);
                  const Icon = g.kind === "EVENT" ? PartyPopper : FerrisWheel;
                  return (
                    <Link key={g.id} href={`/app/catalogo/fichas/${g.id}`} className="group">
                      <Card className={clsx("h-full p-4 transition-colors group-hover:border-brand-300", !g.published && "opacity-60")}>
                        <div className="flex items-start gap-3">
                          <span className={clsx("grid size-10 shrink-0 place-items-center rounded-xl", g.kind === "EVENT" ? "bg-indigo-100 text-indigo-700" : "bg-brand-100 text-brand-700")}>
                            <Icon className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 group-hover:text-brand-700">{g.name}</p>
                            <p className="text-xs text-slate-500">
                              {g.kind === "EVENT" ? `Evento especial en ${g.park}` : "Parque"}
                              {!g.published && " · Borrador"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                          {(g.openTime || g.closeTime) && (
                            <Badge className="bg-slate-100 text-slate-700">
                              <Clock className="mr-1 size-3" /> {[g.openTime, g.closeTime].filter(Boolean).join(" – ")}
                            </Badge>
                          )}
                          <Badge className="bg-slate-100 text-slate-700">
                            {sections.length} secciones · {items} ítems
                          </Badge>
                          {(() => {
                            const next = parseSchedule(g.schedule).filter((d) => d.date >= today);
                            if (next.length === 0) return null;
                            return (
                              <Badge className="bg-emerald-50 text-emerald-800">
                                {g.kind === "EVENT" ? `Próxima: ${formatDate(new Date(`${next[0].date}T00:00:00Z`))}` : `Horarios de ${next.length} ${next.length === 1 ? "día" : "días"}`}
                              </Badge>
                            );
                          })()}
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-slate-500">{sections.map((s) => s.title).join(" · ")}</p>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
