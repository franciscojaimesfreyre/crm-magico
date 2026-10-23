import "server-only";
import { db } from "@/lib/db";
import { avatarSetItem, resolveAvatar, selfTraveler, type AvatarImageOption } from "@/lib/avatars";

/** La galería de personajes de una agencia. */
export async function avatarImages(organizationId: string): Promise<AvatarImageOption[]> {
  return db.avatarImage.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, color: true } });
}

/**
 * El personaje que llegó de un formulario, validado: uno del set propio o una imagen de la galería de
 * esa misma agencia. Devuelve undefined si el formulario no traía el campo (no se toca lo guardado).
 */
export async function avatarFromForm(formData: FormData, organizationId: string, field = "avatar"): Promise<string | null | undefined> {
  if (!formData.has(field)) return undefined;
  const value = String(formData.get(field) ?? "").trim();
  if (!value) return null;
  if (value.startsWith("set:")) return avatarSetItem(value.slice(4)) ? value : null;
  if (value.startsWith("img:")) {
    const img = await db.avatarImage.findFirst({ where: { id: value.slice(4), organizationId }, select: { id: true } });
    return img ? value : null;
  }
  return null;
}

/**
 * El personaje del titular de la cuenta del portal y la galería de su agencia: el portal toma su color y
 * lo muestra arriba a la derecha.
 */
export async function portalPersona(clientId: string) {
  const client = await db.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { firstName: true, organizationId: true, travelers: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, firstName: true, lastName: true, relationship: true, avatar: true } } },
  });
  const images = await avatarImages(client.organizationId);
  const self = selfTraveler(client.firstName, client.travelers);
  return { images, travelers: client.travelers, self, avatar: resolveAvatar(self?.avatar, images) };
}
