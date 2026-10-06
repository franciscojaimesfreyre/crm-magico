import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentClientAccount, getCurrentUser } from "@/lib/auth";
import { readUpload } from "@/lib/storage";

/**
 * Descarga de archivos subidos.
 * - Agentes: cualquier documento de su organización (?lib=1 para la biblioteca).
 * - Clientes del portal: solo documentos visibles de sus propios viajes.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isLibrary = request.nextUrl.searchParams.get("lib") === "1";
  const download = request.nextUrl.searchParams.get("descargar") === "1";

  let file: { name: string; storageKey: string | null; mimeType: string | null } | null = null;

  const user = await getCurrentUser();
  if (user?.organizationId) {
    file = isLibrary
      ? await db.libraryDocument.findFirst({ where: { id, organizationId: user.organizationId } })
      : await db.document.findFirst({ where: { id, organizationId: user.organizationId } });
  } else if (!isLibrary) {
    const account = await getCurrentClientAccount();
    if (account) {
      file = await db.document.findFirst({
        where: {
          id,
          visibleToClient: true,
          OR: [{ clientId: account.clientId }, { booking: { clientId: account.clientId } }],
        },
      });
    }
  }

  if (!file?.storageKey) return new Response("No encontrado", { status: 404 });
  const data = await readUpload(file.storageKey);
  const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
