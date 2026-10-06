import Link from "next/link";
import clsx from "clsx";
import { Globe, Pin, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ConfirmButton } from "@/components/form-controls";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Select, buttonClass } from "@/components/ui";
import { DESTINATIONS, DESTINATION_LABEL, KNOWLEDGE_CATEGORIES, KNOWLEDGE_CATEGORY_LABEL } from "@/lib/labels";
import { formatDate, todayUTC } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";
import type { Destination, KnowledgeCategory } from "@/generated/prisma/enums";
import { deleteKnowledge } from "./actions";
import { AskBox } from "./ask-box";

export const metadata = { title: "Novedades e IA" };

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; destino?: string; categoria?: string; vigencia?: string }>;
}) {
  const user = await requireUser();
  const f = await searchParams;
  const today = todayUTC();
  const and: Prisma.KnowledgeItemWhereInput[] = [{ OR: [{ organizationId: null }, { organizationId: user.organizationId }] }];
  if (f.q) and.push({ OR: [{ title: { contains: f.q, mode: "insensitive" } }, { content: { contains: f.q, mode: "insensitive" } }, { tags: { has: f.q } }] });
  if (f.destino) and.push({ OR: [{ destinations: { has: f.destino as Destination } }, { destinations: { isEmpty: true } }] });
  if (f.categoria) and.push({ category: f.categoria as KnowledgeCategory });
  if (f.vigencia !== "todas") and.push({ OR: [{ validTo: null }, { validTo: { gte: today } }] });

  const items = await db.knowledgeItem.findMany({
    where: { AND: and },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 300,
  });

  return (
    <>
      <PageHeader
        title="Novedades e IA"
        description="Aperturas, cierres, eventos, promociones y tips. La IA usa esta información (vigente y publicada) para proponer itinerarios y redactar cotizaciones."
        actions={<LinkButton href="/app/novedades/nueva">Nueva novedad</LinkButton>}
      />
      <div className="mb-6">
        <AskBox />
      </div>
      <form className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-5">
        <input name="q" defaultValue={f.q} placeholder="Buscar…" className="field sm:col-span-2" />
        <Select name="destino" defaultValue={f.destino ?? ""} options={DESTINATIONS} placeholder="Todos los destinos" />
        <Select name="categoria" defaultValue={f.categoria ?? ""} options={KNOWLEDGE_CATEGORIES} placeholder="Todas las categorías" />
        <div className="flex gap-2">
          <Select name="vigencia" defaultValue={f.vigencia ?? ""} options={[{ value: "todas", label: "Incluir vencidas" }]} placeholder="Solo vigentes" />
          <button className={buttonClass("primary")}>Ver</button>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No hay novedades" description="Cargá la primera: la IA la va a usar al planificar." action={<LinkButton href="/app/novedades/nueva">Nueva novedad</LinkButton>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((k) => {
            const expired = k.validTo && k.validTo < today;
            const editable = k.organizationId === user.organizationId || (k.organizationId === null && user.isPlatformAdmin);
            return (
              <Card key={k.id} className={clsx("flex flex-col p-4", (expired || !k.published) && "opacity-60")}>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {k.pinned && <Pin className="size-3.5 text-brand-600" />}
                  <Badge className="bg-brand-50 text-brand-700">{KNOWLEDGE_CATEGORY_LABEL[k.category]}</Badge>
                  {k.organizationId === null ? (
                    <Badge className="bg-sky-50 text-sky-700">
                      <Globe className="mr-1 size-3" /> Plataforma
                    </Badge>
                  ) : (
                    <Badge>Mi agencia</Badge>
                  )}
                  {!k.published && <Badge className="bg-slate-200">Borrador</Badge>}
                  {expired && <Badge className="bg-rose-50 text-rose-700">Vencida</Badge>}
                </div>
                <h3 className="font-semibold text-slate-900">{k.title}</h3>
                <p className="mt-1 line-clamp-4 flex-1 text-sm whitespace-pre-line text-slate-600">{k.content}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {k.destinations.length ? k.destinations.map((d) => DESTINATION_LABEL[d]).join(", ") : "Todos los destinos"}
                    {k.park && ` · ${k.park}`}
                    {(k.validFrom || k.validTo) && ` · ${k.validFrom ? formatDate(k.validFrom) : "…"} → ${k.validTo ? formatDate(k.validTo) : "…"}`}
                  </span>
                  {editable && (
                    <span className="flex items-center gap-2">
                      <Link href={`/app/novedades/${k.id}`} className="text-brand-700 hover:underline">
                        Editar
                      </Link>
                      <form action={deleteKnowledge.bind(null, k.id)}>
                        <ConfirmButton variant="ghost" message="¿Eliminar esta novedad?">
                          <Trash2 className="size-3.5" />
                        </ConfirmButton>
                      </form>
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
