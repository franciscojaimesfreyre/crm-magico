"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { requestUploadUrl } from "@/app/app/documentos/actions";

const INPUT_CLASS =
  "block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700";

type State =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "done"; key: string; name: string }
  | { status: "error"; message: string };

/**
 * Campo de archivo para formularios de documentos.
 * - direct=true (Cloudflare R2): sube el archivo directo desde el navegador con un link firmado
 *   y manda al servidor solo la clave (uploadKey). Así no hay límite de tamaño del pedido.
 * - direct=false (disco local): el archivo viaja con el formulario como siempre.
 */
export function FileUpload({ direct }: { direct: boolean }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const input = useRef<HTMLInputElement>(null);

  // Cuando el formulario se resetea después de guardar, se limpia el estado.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onReset = () => setState({ status: "idle" });
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  if (!direct) return <input ref={input} type="file" name="file" className={INPUT_CLASS} />;

  async function upload(file: File) {
    setState({ status: "uploading", progress: 0 });
    const target = await requestUploadUrl(file.name, file.type, file.size);
    if ("error" in target && target.error) return setState({ status: "error", message: target.error });
    if (!("url" in target) || !target.url) return setState({ status: "error", message: "No se pudo preparar la subida" });
    const { url, key } = target;
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => e.lengthComputable && setState({ status: "uploading", progress: Math.round((e.loaded / e.total) * 100) });
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
    setState(ok ? { status: "done", key, name: file.name } : { status: "error", message: "Falló la subida. Revisá tu conexión e intentá de nuevo." });
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        className={INPUT_CLASS}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          else setState({ status: "idle" });
        }}
      />
      {state.status === "uploading" && (
        <>
          <input type="hidden" name="uploadPending" value="1" />
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 className="size-3.5 animate-spin" /> Subiendo… {state.progress}%
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded bg-slate-100">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${state.progress}%` }} />
          </div>
        </>
      )}
      {state.status === "done" && (
        <>
          <input type="hidden" name="uploadKey" value={state.key} />
          <input type="hidden" name="uploadName" value={state.name} />
          <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="size-3.5" /> Archivo listo para guardar
          </p>
        </>
      )}
      {state.status === "error" && <p className="mt-1 text-xs text-rose-600">{state.message}</p>}
    </div>
  );
}
