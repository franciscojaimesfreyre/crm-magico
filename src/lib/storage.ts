import "server-only";
import { mkdir, readFile, unlink, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Almacenamiento de archivos con dos modos:
// - "r2": Cloudflare R2 (compatible con S3). El navegador sube directo a R2 con un link firmado y las
//   descargas se redirigen a un link firmado temporal. Se activa cuando están las variables R2_*.
// - "local": disco del servidor (UPLOAD_DIR). Para desarrollo en la propia máquina.
// Las claves siempre empiezan con el id de la organización: "<organizationId>/<uuid>.<ext>".

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv",
]);

/** Links firmados: 15 minutos para subir, 5 para descargar. */
const UPLOAD_URL_TTL = 15 * 60;
const DOWNLOAD_URL_TTL = 5 * 60;

export type StorageMode = "r2" | "local";

export function storageMode(): StorageMode {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  return R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET ? "r2" : "local";
}

/** Valida nombre y tamaño antes de aceptar un archivo. Devuelve el mensaje de error o null. */
export function validateUpload(name: string, size: number) {
  if (!Number.isFinite(size) || size <= 0) return "El archivo está vacío";
  if (size > MAX_UPLOAD_BYTES) return "El archivo supera los 100 MB";
  const ext = path.extname(name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return `Tipo de archivo no permitido (${ext || "sin extensión"})`;
  return null;
}

function newKey(organizationId: string, name: string) {
  return `${organizationId}/${randomUUID()}${path.extname(name).toLowerCase()}`;
}

// ─── Cloudflare R2 ───────────────────────────────────────────────────────────

let s3: S3Client | null = null;
function r2() {
  s3 ??= new S3Client({
    region: "auto",
    // R2_ENDPOINT permite usar otro servicio compatible con S3 (por ejemplo MinIO para pruebas locales).
    endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  return s3;
}
const bucket = () => process.env.R2_BUCKET!;

/**
 * Link firmado para que el navegador suba el archivo directo a R2 (sin pasar por el servidor,
 * así no hay límite de tamaño del pedido). Solo en modo "r2".
 */
export async function createUploadTarget(organizationId: string, name: string, contentType: string, size: number) {
  const error = validateUpload(name, size);
  if (error) return { error };
  const key = newKey(organizationId, name);
  const url = await getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType || "application/octet-stream", ContentLength: size }),
    { expiresIn: UPLOAD_URL_TTL },
  );
  return { key, url };
}

/** Comprueba que un archivo subido directo exista y sea de la organización. Devuelve sus datos o null. */
export async function confirmUpload(organizationId: string, key: string) {
  if (!key.startsWith(`${organizationId}/`) || key.includes("..")) return null;
  try {
    const head = await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { key, size: head.ContentLength ?? 0, mimeType: head.ContentType ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

// ─── Disco local ─────────────────────────────────────────────────────────────

function root() {
  return path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");
}

function resolveKey(key: string) {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("Ruta de archivo inválida");
  return full;
}

// ─── Operaciones comunes ─────────────────────────────────────────────────────

/** Guarda un archivo recibido por el servidor (modo local, o archivos chicos en cualquier modo). */
export async function saveUpload(file: File, organizationId: string) {
  const error = validateUpload(file.name, file.size);
  if (error) throw new Error(error);
  const key = newKey(organizationId, file.name);
  const mimeType = file.type || "application/octet-stream";
  const body = Buffer.from(await file.arrayBuffer());
  if (storageMode() === "r2") {
    await r2().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: mimeType }));
  } else {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }
  return { key, size: file.size, mimeType };
}

/**
 * Cómo entregar un archivo: en R2, un link firmado temporal al que se redirige;
 * en local, el contenido para devolverlo desde la propia app.
 */
export async function downloadTarget(key: string, opts: { filename: string; mimeType: string | null; download: boolean }) {
  const ascii = opts.filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  const disposition = `${opts.download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(opts.filename)}`;
  if (storageMode() === "r2") {
    const url = await getSignedUrl(
      r2(),
      new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
        ResponseContentDisposition: disposition,
        ResponseContentType: opts.mimeType ?? undefined,
      }),
      { expiresIn: DOWNLOAD_URL_TTL },
    );
    return { redirect: url, data: null, disposition };
  }
  return { redirect: null, data: await readFile(resolveKey(key)), disposition };
}

/** Copia un archivo (al adjuntar desde la biblioteca, para que borrarlo allá no afecte la copia). */
export async function duplicateUpload(key: string, organizationId: string) {
  const target = newKey(organizationId, key);
  if (storageMode() === "r2") {
    await r2().send(new CopyObjectCommand({ Bucket: bucket(), CopySource: `${bucket()}/${key}` /* claves seguras: uuid + extensión */, Key: target }));
  } else {
    const full = resolveKey(target);
    await mkdir(path.dirname(full), { recursive: true });
    await copyFile(resolveKey(key), full);
  }
  return target;
}

export async function removeUpload(key: string) {
  try {
    if (storageMode() === "r2") await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    else await unlink(resolveKey(key));
  } catch {
    // Si ya no existe no hay nada que hacer.
  }
}
