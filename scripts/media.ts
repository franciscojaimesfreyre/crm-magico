// Optimiza las imágenes de images/ (personajes y banners) a WebP y las guarda donde la app las sirve:
// - sin variables R2_*: en el disco local (UPLOAD_DIR), para desarrollo;
// - con R2_* (por ejemplo, --env-file=.env.r2): en Cloudflare R2.
// Además deja una copia en storage/media-build/ para subirla con wrangler si se prefiere.
// Uso: npm run media
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { BANNERS, CHARACTERS } from "../src/lib/media";
import { putMedia, storageMode } from "../src/lib/storage";

const SRC = path.resolve("images");
const OUT = path.resolve("storage/media-build");

async function save(key: string, body: Buffer) {
  await putMedia(key, body);
  const local = path.join(OUT, key);
  await mkdir(path.dirname(local), { recursive: true });
  await writeFile(local, body);
  console.log(`  ${key}  ${Math.round(body.length / 1024)} KB`);
}

async function main() {
  console.log(`Destino: ${storageMode() === "r2" ? "Cloudflare R2" : "disco local"}`);
  for (const c of CHARACTERS) {
    const body = await sharp(path.join(SRC, "characters", c.source)).resize(512, 512).webp({ quality: 82 }).toBuffer();
    await save(`media/personajes/${c.id}.webp`, body);
  }
  for (const b of BANNERS) {
    const file = path.join(SRC, "banners", b.source);
    // Grande para escritorio (2400 px de ancho) y chico para teléfonos (1200 px).
    await save(`media/banners/${b.id}.webp`, await sharp(file).resize({ width: 2400 }).webp({ quality: 76 }).toBuffer());
    await save(`media/banners/${b.id}-sm.webp`, await sharp(file).resize({ width: 1200 }).webp({ quality: 74 }).toBuffer());
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
