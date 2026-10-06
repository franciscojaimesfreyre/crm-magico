import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ItineraryView } from "@/components/itinerary-view";
import { DESTINATION_LABEL } from "@/lib/labels";
import { formatRange } from "@/lib/format";

type Props = { params: Promise<{ token: string }> };

async function load(token: string) {
  return db.booking.findUnique({
    where: { shareToken: token },
    include: {
      organization: true,
      agent: true,
      days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { position: "asc" } } } },
      group: { include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { position: "asc" } } } } } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await load((await params).token);
  return { title: b ? `Itinerario · ${b.title}` : "Itinerario", robots: { index: false } };
}

/** Itinerario compartible por link (sin login). No muestra datos personales ni precios. */
export default async function SharedItinerary({ params }: Props) {
  const { token } = await params;
  const b = await load(token);
  if (!b || b.status === "CANCELLED") notFound();
  const days = b.days.length ? b.days : (b.group?.days ?? []);
  return (
    <div className="min-h-screen bg-[#faf8f5] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 rounded-3xl bg-gradient-to-br from-brand-800 to-fuchsia-700 p-6 text-white">
          <p className="text-sm text-white/70">{b.organization.name}</p>
          <h1 className="text-2xl font-semibold">{b.title}</h1>
          <p className="text-white/80">
            {DESTINATION_LABEL[b.destination]} · {formatRange(b.startDate, b.endDate)}
          </p>
          {b.agent && <p className="mt-2 text-sm text-white/70">Planificado por {b.agent.name}</p>}
        </header>
        {days.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-slate-500">El itinerario todavía está en preparación.</p>
        ) : (
          <ItineraryView days={days} />
        )}
      </div>
    </div>
  );
}
