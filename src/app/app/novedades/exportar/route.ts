import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toDateInput } from "@/lib/format";
import { KNOWLEDGE_FORMAT, type KnowledgeExportItem } from "@/lib/knowledge-io";

/** Descarga en JSON las novedades que ve el agente: las de la plataforma y las de su agencia (también vencidas y borradores). */
export async function GET() {
  const user = await requireUser();
  const items = await db.knowledgeItem.findMany({
    where: { OR: [{ organizationId: null }, { organizationId: user.organizationId }] },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  const exported: KnowledgeExportItem[] = items.map((k) => ({
    title: k.title,
    content: k.content,
    category: k.category,
    destinations: k.destinations,
    park: k.park,
    tags: k.tags,
    validFrom: k.validFrom ? toDateInput(k.validFrom) : null,
    validTo: k.validTo ? toDateInput(k.validTo) : null,
    sourceUrl: k.sourceUrl,
    published: k.published,
    pinned: k.pinned,
    scope: k.organizationId === null ? "global" : "agencia",
  }));
  const body = JSON.stringify({ format: KNOWLEDGE_FORMAT, version: 1, exportedAt: new Date().toISOString(), items: exported }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="novedades-${toDateInput(new Date())}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
