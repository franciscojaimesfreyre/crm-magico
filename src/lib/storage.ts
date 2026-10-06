import "server-only";
import { mkdir, readFile, unlink, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Almacenamiento local en disco. Para producción se puede reemplazar por S3/R2
// manteniendo esta misma interfaz (save / read / remove / duplicate).

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv",
]);

function root() {
  return path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");
}

function resolveKey(key: string) {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("Ruta de archivo inválida");
  return full;
}

export async function saveUpload(file: File, organizationId: string) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("El archivo supera los 100 MB");
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error(`Tipo de archivo no permitido (${ext || "sin extensión"})`);
  const key = `${organizationId}/${randomUUID()}${ext}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return { key, size: file.size, mimeType: file.type || "application/octet-stream" };
}

export async function readUpload(key: string) {
  return readFile(resolveKey(key));
}

/** Copia un archivo (al adjuntar desde la biblioteca, para que borrarlo allá no afecte la copia). */
export async function duplicateUpload(key: string, organizationId: string) {
  const newKey = `${organizationId}/${randomUUID()}${path.extname(key)}`;
  const target = resolveKey(newKey);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(resolveKey(key), target);
  return newKey;
}

export async function removeUpload(key: string) {
  try {
    await unlink(resolveKey(key));
  } catch {
    // Si ya no existe no hay nada que hacer.
  }
}
