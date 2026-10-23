import { mediaTarget } from "@/lib/storage";

/**
 * Imágenes propias del producto (personajes y banners, lib/media.ts). Son públicas: no muestran datos de
 * nadie. En R2 se redirige a un link firmado; en local se entregan desde el disco.
 */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = await mediaTarget(`media/${path.join("/")}`);
  if (!target) return new Response("No encontrado", { status: 404 });
  if (target.redirect) {
    return new Response(null, { status: 302, headers: { Location: target.redirect, "Cache-Control": "public, max-age=240" } });
  }
  return new Response(new Uint8Array(target.data!), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}
