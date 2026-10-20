import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SECTION_LABEL, emptySheet, todayInOrlando, type SectionKind } from "@/lib/park-sheet";
import { GuideEditor } from "../guide-editor";

export const metadata = { title: "Nueva ficha" };

const PARK_SECTIONS: SectionKind[] = ["MUST_DO", "MILD", "SHOWS", "CHARACTERS", "DINING", "SNACKS", "TIPS"];
const EVENT_SECTIONS: SectionKind[] = ["SHOWS", "CHARACTERS", "MILD", "TIPS"];

export default async function NewParkGuidePage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin) notFound();
  const event = (await searchParams).tipo === "EVENT";
  const sheet = {
    ...emptySheet(""),
    kind: event ? ("EVENT" as const) : ("PARK" as const),
    hoursNote: "Horarios de referencia: cambian según la fecha. Revisar la app el día anterior.",
    sections: (event ? EVENT_SECTIONS : PARK_SECTIONS).map((kind) => ({ kind, title: SECTION_LABEL[kind], items: [{ name: "", detail: "", time: "" }], note: "" })),
  };
  return (
    <div className="max-w-5xl">
      <PageHeader title={event ? "Nuevo evento especial" : "Nuevo parque"} back={{ href: "/app/catalogo/fichas", label: "Fichas de parques" }} />
      <GuideEditor id={null} today={todayInOrlando()} initial={{ sheet, destination: "DISNEY_WORLD", aliases: [], published: true, schedule: [] }} />
    </div>
  );
}
