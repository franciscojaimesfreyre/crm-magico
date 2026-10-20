"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import clsx from "clsx";
import { buttonClass } from "@/components/ui";
import { importCatalog } from "./actions";

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Exportar todo el catálogo (lugares y fichas) a JSON e importarlo (solo admins de la plataforma). */
export function CatalogImportExport({ canImport }: { canImport: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startImport] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!window.confirm("Se agregan los lugares y fichas nuevos y se actualizan los que ya existen con los datos del archivo. No se borra nada. ¿Importar?")) {
      if (input.current) input.current.value = "";
      return;
    }
    startImport(async () => {
      setMessage(null);
      const res = await importCatalog(await file.text()).catch(() => ({ error: "No se pudo importar el archivo." }));
      if ("error" in res || !("entriesCreated" in res)) setMessage({ tone: "error", text: ("error" in res && res.error) || "No se pudo importar el archivo." });
      else {
        const parts = [
          `Lugares: ${n(res.entriesCreated, "nuevo", "nuevos")}, ${n(res.entriesUpdated, "actualizado", "actualizados")}`,
          `Fichas: ${n(res.guidesCreated, "nueva", "nuevas")}, ${n(res.guidesUpdated, "actualizada", "actualizadas")}`,
          res.invalid > 0 && `${res.invalid} con datos inválidos (no se importaron)`,
        ].filter(Boolean);
        setMessage({ tone: res.invalid > 0 ? "error" : "ok", text: `${parts.join(" · ")}.` });
        router.refresh();
      }
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <a href="/app/catalogo/exportar" download className={buttonClass("secondary")}>
          <Download className="size-4" /> Exportar JSON
        </a>
        {canImport && (
          <>
            <button type="button" onClick={() => input.current?.click()} disabled={pending} className={buttonClass("secondary")}>
              <Upload className="size-4" /> {pending ? "Importando…" : "Importar JSON"}
            </button>
            <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </>
        )}
      </div>
      {message && <p className={clsx("max-w-md text-right text-xs", message.tone === "ok" ? "text-emerald-700" : "text-rose-700")}>{message.text}</p>}
    </div>
  );
}
