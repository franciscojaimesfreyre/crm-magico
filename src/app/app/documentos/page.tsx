import { ExternalLink, FileText, Folder, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Card, CardHeader, EmptyState, Field, Input, PageHeader } from "@/components/ui";
import { fileSize, formatDate } from "@/lib/format";
import { addLibraryDocument, deleteLibraryDocument } from "./actions";

export const metadata = { title: "Documentos" };

export default async function LibraryPage() {
  const user = await requireUser();
  const docs = await db.libraryDocument.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ folder: "asc" }, { name: "asc" }],
  });
  const folders = new Map<string, typeof docs>();
  for (const d of docs) folders.set(d.folder ?? "", [...(folders.get(d.folder ?? "") ?? []), d]);
  const folderNames = [...folders.keys()].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Biblioteca de documentos"
        description="Guías, checklists y políticas que reutilizás. Se adjuntan a cualquier viaje con un clic desde la pestaña Documentos."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {docs.length === 0 && <EmptyState title="Tu biblioteca está vacía" description="Subí tu checklist de equipaje, la guía de Lightning Lane, requisitos de pasaporte…" />}
          {[...folders.entries()].map(([folder, list]) => (
            <Card key={folder || "_"}>
              <CardHeader title={<span className="flex items-center gap-2"><Folder className="size-4 text-brand-500" />{folder || "Sin carpeta"}</span>} />
              <ul className="divide-y divide-slate-100">
                {list.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <a href={d.storageKey ? `/api/archivos/${d.id}?lib=1` : (d.url ?? "#")} target="_blank" className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700">
                          {d.name} {!d.storageKey && <ExternalLink className="inline size-3" />}
                        </a>
                        <p className="text-xs text-slate-500">{[d.storageKey ? fileSize(d.size) : "Link", formatDate(d.createdAt)].join(" · ")}</p>
                      </div>
                    </div>
                    <form action={deleteLibraryDocument.bind(null, d.id)}>
                      <ConfirmButton variant="ghost" message="¿Eliminar de la biblioteca? Las copias ya adjuntadas a viajes se mantienen.">
                        <Trash2 className="size-3.5" />
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <Card className="self-start">
          <CardHeader title="Agregar a la biblioteca" />
          <ActionForm action={addLibraryDocument} resetOnSuccess className="space-y-3 p-4">
            <Field label="Archivo">
              <input type="file" name="file" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700" />
            </Field>
            <Field label="…o link" hint="Canva, Google Docs, Drive…">
              <Input name="url" type="url" placeholder="https://" />
            </Field>
            <Field label="Nombre">
              <Input name="name" placeholder="Ej: Checklist de equipaje Disney" />
            </Field>
            <Field label="Carpeta">
              <Input name="folder" list="folders" placeholder="Ej: Guías" />
              <datalist id="folders">
                {folderNames.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </Field>
            <SubmitButton className="w-full" pendingText="Subiendo…">
              Agregar
            </SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
