"use server";

import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { incomingFile } from "@/lib/incoming-files";
import { removeUpload } from "@/lib/storage";
import { AVATAR_COLORS } from "@/lib/avatars";
import type { ActionState } from "@/components/form-controls";

const IMAGE_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

/** Suma una imagen a la galería de personajes de la agencia. */
export async function addAvatarImage(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const incoming = await incomingFile(formData, user.organizationId);
  if (!incoming) return { error: "Elegí una imagen" };
  if ("error" in incoming) return { error: incoming.error };
  const ext = path.extname(incoming.stored.key).toLowerCase();
  if (!IMAGE_TYPES[ext] || incoming.stored.size > 5 * 1024 * 1024) {
    await removeUpload(incoming.stored.key);
    return { error: IMAGE_TYPES[ext] ? "La imagen supera los 5 MB" : "Tiene que ser una imagen PNG, JPG, WEBP o GIF" };
  }
  const name = String(formData.get("name") ?? "").trim() || incoming.name.replace(/\.[^.]+$/, "");
  const color = String(formData.get("color") ?? "");
  await db.avatarImage.create({
    data: {
      organizationId: user.organizationId,
      name: name.slice(0, 40),
      color: AVATAR_COLORS.includes(color) ? color : AVATAR_COLORS[0],
      storageKey: incoming.stored.key,
      mimeType: IMAGE_TYPES[ext],
    },
  });
  revalidatePath("/app/configuracion");
  return { ok: "Personaje agregado" };
}

/** Saca una imagen de la galería; los viajeros que la tenían vuelven a sus iniciales. */
export async function deleteAvatarImage(id: string) {
  const user = await requireUser();
  const img = await db.avatarImage.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!img) return;
  await db.traveler.updateMany({ where: { avatar: `img:${id}`, client: { organizationId: user.organizationId } }, data: { avatar: null } });
  await db.avatarImage.delete({ where: { id } });
  await removeUpload(img.storageKey);
  revalidatePath("/app/configuracion");
}
