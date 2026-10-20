// Archivos que llegan con un formulario: o ya subidos a R2 por el navegador (clave + nombre), o el
// archivo en sí (modo local). Ver components/file-upload.
import "server-only";
import { confirmUpload, saveUpload } from "@/lib/storage";

export type StoredFile = { stored: { key: string; size: number; mimeType: string }; name: string };

/** Un archivo (FileUpload): null si no vino ninguno. */
export async function incomingFile(formData: FormData, organizationId: string): Promise<StoredFile | { error: string } | null> {
  if (formData.get("uploadPending") === "1") return { error: "Esperá a que termine de subir el archivo" };
  const uploadKey = String(formData.get("uploadKey") ?? "");
  if (uploadKey) {
    const stored = await confirmUpload(organizationId, uploadKey);
    if (!stored) return { error: "No encontramos el archivo subido. Probá subirlo de nuevo." };
    return { stored, name: String(formData.get("uploadName") ?? "").trim() || "Archivo" };
  }
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    try {
      return { stored: await saveUpload(file, organizationId), name: file.name };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No se pudo subir el archivo" };
    }
  }
  return null;
}

/** Varios archivos (MultiFileUpload): lista vacía si no vino ninguno. */
export async function incomingFiles(formData: FormData, organizationId: string): Promise<StoredFile[] | { error: string }> {
  if (formData.get("uploadPending") === "1") return { error: "Esperá a que terminen de subir los archivos" };
  const out: StoredFile[] = [];
  const keys = formData.getAll("uploadKeys").map(String);
  const names = formData.getAll("uploadNames").map(String);
  for (const [i, key] of keys.entries()) {
    const stored = await confirmUpload(organizationId, key);
    if (!stored) return { error: "No encontramos uno de los archivos subidos. Probá subirlo de nuevo." };
    out.push({ stored, name: names[i]?.trim() || "Archivo" });
  }
  for (const file of formData.getAll("files")) {
    if (!(file instanceof File) || file.size === 0) continue;
    try {
      out.push({ stored: await saveUpload(file, organizationId), name: file.name });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No se pudo subir el archivo" };
    }
  }
  return out;
}
