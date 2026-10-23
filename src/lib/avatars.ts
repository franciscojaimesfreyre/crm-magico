import { CHARACTERS, characterSrc } from "@/lib/media";

// Personajes de los viajeros. Un avatar se guarda como texto en Traveler.avatar:
// - "set:<id>": uno de los personajes ilustrados del producto (lib/media.ts).
// - "img:<id>": una imagen de la galería de la agencia (AvatarImage), servida por /api/avatares/<id>.

export type AvatarSetItem = { id: string; label: string; color: string };

/** El set propio: los personajes ilustrados de lib/media.ts. */
export const AVATAR_SET: { group: string; items: AvatarSetItem[] }[] = [{ group: "Personajes", items: CHARACTERS.map(({ id, label, color }) => ({ id, label, color })) }];

const BY_ID = new Map(AVATAR_SET.flatMap((g) => g.items).map((i) => [i.id, i]));

export function avatarSetItem(id: string) {
  return BY_ID.get(id) ?? null;
}

/** Una imagen de la galería de la agencia, como la necesita la interfaz. */
export type AvatarImageOption = { id: string; name: string; color: string };

export type ResolvedAvatar = { kind: "set" | "img"; id: string; label: string; color: string; src: string };

/** Traduce el valor guardado a lo que se dibuja. Null si no tiene o si ya no existe (imagen borrada). */
export function resolveAvatar(value: string | null | undefined, images: AvatarImageOption[] = []): ResolvedAvatar | null {
  if (!value) return null;
  if (value.startsWith("set:")) {
    const item = avatarSetItem(value.slice(4));
    return item ? { kind: "set", ...item, src: characterSrc(item.id) } : null;
  }
  if (value.startsWith("img:")) {
    const img = images.find((i) => i.id === value.slice(4));
    return img ? { kind: "img", id: img.id, label: img.name, color: img.color, src: `/api/avatares/${img.id}` } : null;
  }
  return null;
}

/** Colores que la agencia puede elegir para sus imágenes (tonos oscuros, para texto blanco encima). */
export const AVATAR_COLORS = ["#0e7c70", "#1d4ed8", "#4338ca", "#6d28d9", "#a21caf", "#be185d", "#be123c", "#c2410c", "#b45309", "#15803d", "#0e7490", "#334155"];

/**
 * El viajero que representa al titular de la cuenta del portal: el marcado como titular, si no el que
 * se llama como el cliente, si no el primero con personaje.
 */
export function selfTraveler<T extends { firstName: string; relationship: string | null; avatar: string | null }>(clientFirstName: string, travelers: T[]): T | null {
  const norm = (s: string) => s.trim().toLowerCase();
  return (
    travelers.find((t) => t.relationship && /titular/i.test(t.relationship)) ??
    travelers.find((t) => norm(t.firstName) === norm(clientFirstName)) ??
    travelers.find((t) => t.avatar) ??
    null
  );
}
