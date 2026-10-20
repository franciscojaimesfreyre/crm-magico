import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ParkSheetCard } from "@/components/park-sheet";
import { DESTINATION_LABEL } from "@/lib/labels";
import { sheetFromGuide } from "@/lib/park-sheet";
import { toGuideOption } from "@/lib/park-guides";
import { GuideEditor } from "../guide-editor";

export const metadata = { title: "Ficha de parque" };

export default async function ParkGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const guide = await db.parkGuide.findUnique({ where: { id } });
  if (!guide) notFound();
  const sheet = sheetFromGuide(toGuideOption(guide));
  const subtitle = `${DESTINATION_LABEL[guide.destination]} · ${guide.kind === "EVENT" ? `Evento especial en ${guide.park}` : "Parque"}`;
  return (
    <div className="max-w-5xl">
      <PageHeader title={guide.name} description={subtitle} back={{ href: "/app/catalogo/fichas", label: "Fichas de parques" }} />
      {user.isPlatformAdmin ? (
        <GuideEditor id={guide.id} initial={{ sheet, destination: guide.destination, aliases: guide.aliases, published: guide.published }} />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">Así aparece en los itinerarios. En cada itinerario la podés editar para ese viaje.</p>
          <ParkSheetCard sheet={sheet} />
        </>
      )}
    </div>
  );
}
