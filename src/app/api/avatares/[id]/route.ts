import { db } from "@/lib/db";
import { getCurrentClientAccount, getCurrentUser } from "@/lib/auth";
import { downloadTarget } from "@/lib/storage";

/**
 * Imagen de la galería de personajes de una agencia. La ven sus agentes y los clientes de esa agencia
 * (en su portal); para el resto no existe.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let organizationId: string | null = null;
  const user = await getCurrentUser();
  if (user?.organizationId) organizationId = user.organizationId;
  else {
    const account = await getCurrentClientAccount();
    if (account) organizationId = (await db.client.findUnique({ where: { id: account.clientId }, select: { organizationId: true } }))?.organizationId ?? null;
  }
  if (!organizationId) return new Response("No encontrado", { status: 404 });

  const img = await db.avatarImage.findFirst({ where: { id, organizationId } });
  if (!img) return new Response("No encontrado", { status: 404 });
  const target = await downloadTarget(img.storageKey, { filename: img.name, mimeType: img.mimeType, download: false });
  if (target.redirect) {
    return new Response(null, { status: 302, headers: { Location: target.redirect, "Cache-Control": "private, max-age=240" } });
  }
  return new Response(new Uint8Array(target.data!), {
    headers: {
      "Content-Type": img.mimeType || "image/png",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
