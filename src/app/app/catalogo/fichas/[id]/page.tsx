import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ParkSheetCard } from "@/components/park-sheet";
import { DESTINATION_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { parseSchedule, sheetFromGuide, todayInOrlando } from "@/lib/park-sheet";
import { toGuideOption } from "@/lib/park-guides";
import { apiParks, type ApiPark } from "@/lib/themeparks";
import { LightningLanePrices, ThemeParksCredit } from "@/components/themeparks";
import { GuideEditor } from "../guide-editor";

/** Días que se ven antes de "Ver todos". */
const VISIBLE_DAYS = 10;

/** Parques de ThemeParks.wiki para vincular la ficha (sin conexión, solo se muestra el vínculo actual). */
async function apiParkOptions(): Promise<ApiPark[]> {
  try {
    return await apiParks();
  } catch (e) {
    console.error("Error leyendo los parques de ThemeParks.wiki", e);
    return [];
  }
}

export const metadata = { title: "Ficha de parque" };

export default async function ParkGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const guide = await db.parkGuide.findUnique({ where: { id } });
  if (!guide) notFound();
  const sheet = sheetFromGuide(toGuideOption(guide));
  const today = todayInOrlando();
  const upcoming = parseSchedule(guide.schedule).filter((d) => d.date >= today);
  const subtitle = `${DESTINATION_LABEL[guide.destination]} · ${guide.kind === "EVENT" ? `Evento especial en ${guide.park}` : "Parque"}`;
  return (
    <div className="max-w-5xl">
      <PageHeader title={guide.name} description={subtitle} back={{ href: "/app/catalogo/fichas", label: "Fichas de parques" }} />
      {user.isPlatformAdmin ? (
        <GuideEditor
          id={guide.id}
          today={todayInOrlando()}
          apiParks={guide.kind === "PARK" ? await apiParkOptions() : []}
          initial={{ sheet, destination: guide.destination, aliases: guide.aliases, published: guide.published, schedule: parseSchedule(guide.schedule), apiId: guide.apiId }}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">Así aparece en los itinerarios. En cada itinerario la podés editar para ese viaje.</p>
          {upcoming.length > 0 && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-sm font-semibold text-slate-900">{guide.kind === "EVENT" ? "Próximas fechas" : "Horarios de los próximos días"}</p>
              {[upcoming.slice(0, VISIBLE_DAYS), upcoming.slice(VISIBLE_DAYS)].map(
                (days, i) =>
                  days.length > 0 && (
                    <Wrap key={i} more={i === 1 ? days.length : 0}>
                      <ul className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                        {days.map((d) => (
                          <li key={d.date}>
                            <div className="flex flex-wrap gap-x-2">
                              <span className="font-medium text-slate-700">{formatDate(new Date(`${d.date}T00:00:00Z`))}</span>
                              <span className="text-slate-900">{[d.openTime, d.closeTime].filter(Boolean).join(" – ") || "—"}</span>
                              {d.note && <span className="text-xs text-slate-500">{d.note}</span>}
                            </div>
                            <LightningLanePrices entry={d} />
                          </li>
                        ))}
                      </ul>
                    </Wrap>
                  ),
              )}
              {upcoming.some((d) => d.synced) && <ThemeParksCredit className="mt-2 block" />}
            </div>
          )}
          <ParkSheetCard sheet={sheet} />
        </>
      )}
    </div>
  );
}

/** Los días que no entran en la vista: se despliegan. */
function Wrap({ more, children }: { more: number; children: React.ReactNode }) {
  if (!more) return children;
  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer text-sm font-medium text-brand-700 select-none hover:underline">Ver {more} días más</summary>
      <div className="mt-1.5">{children}</div>
    </details>
  );
}
