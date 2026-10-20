import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ParkSheetCard } from "@/components/park-sheet";
import { DESTINATION_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { parseSchedule, sheetFromGuide, todayInOrlando } from "@/lib/park-sheet";
import { toGuideOption } from "@/lib/park-guides";
import { GuideEditor } from "../guide-editor";

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
          initial={{ sheet, destination: guide.destination, aliases: guide.aliases, published: guide.published, schedule: parseSchedule(guide.schedule) }}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">Así aparece en los itinerarios. En cada itinerario la podés editar para ese viaje.</p>
          {upcoming.length > 0 && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-sm font-semibold text-slate-900">{guide.kind === "EVENT" ? "Próximas fechas" : "Horarios de los próximos días"}</p>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {upcoming.map((d) => (
                  <li key={d.date} className="flex flex-wrap gap-x-2">
                    <span className="font-medium text-slate-700">{formatDate(new Date(`${d.date}T00:00:00Z`))}</span>
                    <span className="text-slate-900">{[d.openTime, d.closeTime].filter(Boolean).join(" – ") || "—"}</span>
                    {d.note && <span className="text-xs text-slate-500">{d.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ParkSheetCard sheet={sheet} />
        </>
      )}
    </div>
  );
}
