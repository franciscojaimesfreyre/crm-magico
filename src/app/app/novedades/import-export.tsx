"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Upload } from "lucide-react";
import clsx from "clsx";
import { buttonClass } from "@/components/ui";
import { importKnowledge } from "./actions";

/** Exportar todas las novedades a JSON e importar un JSON exportado (agrega, no reemplaza). */
export function KnowledgeImportExport() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startImport] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    startImport(async () => {
      setMessage(null);
      const res = await importKnowledge(await file.text()).catch(() => ({ error: "No se pudo importar el archivo." }));
      if ("error" in res || !("created" in res)) setMessage({ tone: "error", text: ("error" in res && res.error) || "No se pudo importar el archivo." });
      else {
        const parts = [
          `${res.created} ${res.created === 1 ? "novedad agregada" : "novedades agregadas"}`,
          res.skipped > 0 && `${res.skipped} ya ${res.skipped === 1 ? "existía" : "existían"} (mismo título)`,
          res.invalid > 0 && `${res.invalid} con datos inválidos`,
          res.asAgency > 0 && `${res.asAgency} de la plataforma ${res.asAgency === 1 ? "quedó" : "quedaron"} como de tu agencia (solo un admin general carga novedades globales)`,
        ].filter(Boolean);
        setMessage({ tone: res.created > 0 || res.invalid === 0 ? "ok" : "error", text: `${parts.join(" · ")}.` });
      }
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <a href="/app/novedades/exportar" download className={buttonClass("secondary")}>
          <Download className="size-4" /> Exportar JSON
        </a>
        <button type="button" onClick={() => input.current?.click()} disabled={pending} className={buttonClass("secondary")}>
          <Upload className="size-4" /> {pending ? "Importando…" : "Importar JSON"}
        </button>
        <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {message && <p className={clsx("text-xs", message.tone === "ok" ? "text-emerald-700" : "text-rose-700")}>{message.text}</p>}
    </div>
  );
}
