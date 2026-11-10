import { FileText, Image as ImageIcon, X } from "lucide-react";
import { deleteDocument } from "@/app/app/documentos/actions";

type Doc = { id: string; name: string; storageKey: string | null; url: string | null; mimeType: string | null };

/** Adjuntos como chips que abren el archivo. Con `removable`, cada uno lleva una cruz para quitarlo (solo agentes). */
export function AttachmentChips({ docs, removable = false }: { docs: Doc[]; removable?: boolean }) {
  if (docs.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {docs.map((d) => {
        const Icon = d.mimeType?.startsWith("image/") ? ImageIcon : FileText;
        return (
          <li key={d.id} className="inline-flex max-w-64 items-center rounded-md bg-slate-100 text-xs text-slate-700">
            <a
              href={d.storageKey ? `/api/archivos/${d.id}` : (d.url ?? "#")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-0.5 hover:bg-brand-50 hover:text-brand-700"
            >
              <Icon className="size-3 shrink-0" /> <span className="truncate">{d.name}</span>
            </a>
            {removable && (
              <form action={deleteDocument.bind(null, d.id)}>
                <button className="rounded p-0.5 pr-1.5 text-slate-400 hover:text-rose-600" title="Quitar adjunto" aria-label={`Quitar ${d.name}`}>
                  <X className="size-3" />
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
