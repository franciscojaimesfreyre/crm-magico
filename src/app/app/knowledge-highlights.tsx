import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, CalendarRange, Newspaper, Pin } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui";
import { DESTINATION_LABEL, KNOWLEDGE_CATEGORY_LABEL } from "@/lib/labels";
import { daysBetween, formatDate, todayUTC } from "@/lib/format";
import { isWarning } from "@/lib/knowledge-alerts";
import type { KnowledgeItem } from "@/generated/prisma/client";

/** Resumen de novedades en el inicio: algunas vigentes y las próximas, con link a todas. */
export function KnowledgeHighlights({ current, upcoming, total }: { current: KnowledgeItem[]; upcoming: KnowledgeItem[]; total: number }) {
  if (current.length + upcoming.length === 0) return null;
  return (
    <Card className="mb-6">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Newspaper className="size-4 text-brand-600" /> Novedades
          </span>
        }
        description="Lo vigente y lo que se viene en los parques. La IA también lo tiene en cuenta."
        actions={
          <Link href="/app/novedades" className="text-xs font-medium text-brand-700 hover:underline">
            Ver todas ({total}) →
          </Link>
        }
      />
      <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
        <Column title="Vigentes" items={current} empty="Nada vigente por ahora." />
        <Column title="Próximamente" items={upcoming} empty="Nada anunciado para los próximos meses." />
      </div>
    </Card>
  );
}

function Column({ title, items, empty }: { title: string; items: KnowledgeItem[]; empty: string }) {
  return (
    <div className="min-w-0">
      <p className="px-5 pt-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{title}</p>
      {items.length === 0 ? (
        <p className="px-5 py-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul>
          {items.map((k) => (
            <li key={k.id}>
              <details className="group px-5 py-2.5">
                <summary className="flex cursor-pointer list-none items-start gap-2.5">
                  {isWarning(k.category) ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  ) : (
                    <CalendarRange className="mt-0.5 size-4 shrink-0 text-brand-500" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-1 text-sm font-medium text-slate-800 group-open:text-brand-700">
                      {k.pinned && <Pin className="mt-0.5 size-3 shrink-0 text-brand-600" />}
                      <span className="line-clamp-2">{k.title}</span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <Badge className="bg-slate-100 text-slate-700">{KNOWLEDGE_CATEGORY_LABEL[k.category]}</Badge>
                      <When item={k} />
                      {k.destinations.length > 0 && <span className="truncate">{k.destinations.map((d) => DESTINATION_LABEL[d]).join(", ")}</span>}
                    </span>
                  </span>
                </summary>
                <p className="mt-2 ml-6.5 line-clamp-6 text-sm whitespace-pre-line text-slate-600">{k.content}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Empieza en 12 días", "Hasta el 16/12", etc. */
function When({ item: k }: { item: KnowledgeItem }) {
  const today = todayUTC();
  if (k.validFrom && k.validFrom > today) {
    const days = daysBetween(today, k.validFrom);
    return <span className={clsx(days <= 14 && "font-medium text-brand-700")}>{days === 1 ? "Empieza mañana" : `Empieza en ${days} días`} · {formatDate(k.validFrom)}</span>;
  }
  if (k.validTo) return <span>Hasta el {formatDate(k.validTo)}</span>;
  if (k.validFrom) return <span>Desde el {formatDate(k.validFrom)}</span>;
  return null;
}
