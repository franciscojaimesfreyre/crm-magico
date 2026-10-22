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
    const r = await uploadDirect(file, (progress) => setState({ status: "uploading", progress }));
    setState("key" in r ? { status: "done", key: r.key, name: file.name } : { status: "error", message: r.error });
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
            <div className="h-full bg-brand-500 transition-[width]" style={{ width: `${state.progress}%` }} />
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
      {state.status === "error" && <p className="mt-1 text-xs text-rose-700">{state.message}</p>}
    </div>
  );
}

type Pending = { id: number; name: string } & ({ status: "uploading"; progress: number } | { status: "done"; key: string } | { status: "error"; message: string });

/** Sube un archivo a R2 con un link firmado; avisa el progreso. Devuelve la clave o un error. */
async function uploadDirect(file: File, onProgress: (percent: number) => void): Promise<{ key: string } | { error: string }> {
  const target = await requestUploadUrl(file.name, file.type, file.size);
  if ("error" in target && target.error) return { error: target.error };
  if (!("url" in target) || !target.url) return { error: "No se pudo preparar la subida" };
  const { url, key } = target;
  const ok = await new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
  return ok ? { key } : { error: "Falló la subida. Revisá tu conexión e intentá de nuevo." };
}

/**
 * Varios archivos a la vez (vouchers, recibos…). Igual que FileUpload: con R2 sube cada archivo desde
 * el navegador y manda uploadKeys/uploadNames; en disco local los archivos viajan con el formulario (files).
 */
export function MultiFileUpload({ direct }: { direct: boolean }) {
  const [files, setFiles] = useState<Pending[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onReset = () => setFiles([]);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  if (!direct) return <input ref={input} type="file" name="files" multiple className={INPUT_CLASS} />;

  const update = (id: number, patch: Partial<Pending>) => setFiles((list) => list.map((f) => (f.id === id ? ({ ...f, ...patch } as Pending) : f)));

  function add(list: FileList) {
    for (const file of Array.from(list)) {
      const id = nextId.current++;
      setFiles((prev) => [...prev, { id, name: file.name, status: "uploading", progress: 0 }]);
      void uploadDirect(file, (progress) => update(id, { progress })).then((r) =>
        update(id, "key" in r ? { status: "done", key: r.key } : { status: "error", message: r.error }),
      );
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        multiple
        className={INPUT_CLASS}
        onChange={(e) => {
          if (e.target.files?.length) add(e.target.files);
          e.target.value = "";
        }}
      />
      {files.some((f) => f.status === "uploading") && <input type="hidden" name="uploadPending" value="1" />}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-xs">
              {f.status === "uploading" && <Loader2 className="size-3.5 shrink-0 animate-spin text-slate-500" />}
              {f.status === "done" && (
                <>
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-700" />
                  <input type="hidden" name="uploadKeys" value={f.key} />
                  <input type="hidden" name="uploadNames" value={f.name} />
                </>
              )}
              <span className={f.status === "error" ? "truncate text-rose-700" : "truncate text-slate-700"}>
                {f.name}
                {f.status === "uploading" && ` · ${f.progress}%`}
                {f.status === "error" && ` · ${f.message}`}
              </span>
              <button type="button" onClick={() => setFiles((list) => list.filter((x) => x.id !== f.id))} className="ml-auto text-slate-500 hover:text-rose-600">
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
