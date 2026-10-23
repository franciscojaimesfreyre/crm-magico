// Imágenes propias del producto: los personajes de los viajeros y los banners de los viajes.
// Los originales están en images/ (fuera del repo); scripts/media.ts los optimiza a WebP y los sube a
// "media/personajes/<id>.webp" y "media/banners/<id>.webp" (+ "-sm" para teléfonos). Se sirven por /media/….

export type CharacterItem = { id: string; label: string; color: string; source: string };
export type BannerItem = {
  id: string;
  label: string;
  source: string;
  /** Muestra personajes con marca (Marvel, Star Wars, Pixar, Harry Potter): reemplazar antes del lanzamiento. */
  temporal?: true;
};

/**
 * Personajes. El color es un tono oscuro del fondo de cada ilustración: es el del avatar sin imagen y el
 * del portal cuando es el personaje del titular (lleva texto blanco encima).
 */
export const CHARACTERS: CharacterItem[] = [
  { id: "princesa", label: "Princesa", color: "#a3326c", source: "Gemini_Generated_Image_i0mhbgi0mhbgi0mh.jpeg" },
  { id: "mago", label: "Mago", color: "#56409a", source: "Gemini_Generated_Image_64e2df64e2df64e2.jpeg" },
  { id: "maga", label: "Maga", color: "#86378a", source: "Gemini_Generated_Image_9hyy1n9hyy1n9hyy.jpeg" },
  { id: "astronauta", label: "Astronauta", color: "#1e3a6b", source: "Gemini_Generated_Image_v059agv059agv059.jpeg" },
  { id: "vaquero", label: "Vaquero", color: "#a14a0c", source: "Gemini_Generated_Image_g2rzxmg2rzxmg2rz.jpeg" },
  { id: "dinosaurio", label: "Dinosaurio", color: "#4b6a2c", source: "Gemini_Generated_Image_2m6vcg2m6vcg2m6v.jpeg" },
  { id: "leoncito", label: "Leoncito", color: "#8a5c0c", source: "Gemini_Generated_Image_ajfsqbajfsqbajfs.jpeg" },
  { id: "dalmata", label: "Dálmata", color: "#0e7c70", source: "Gemini_Generated_Image_qazsxjqazsxjqazs.jpeg" },
];

export const BANNERS: BannerItem[] = [
  { id: "castillo", label: "Castillo de princesas", source: "Gemini_Generated_Image_pupgzjpupgzjpupg.jpeg" },
  { id: "montanas-rusas", label: "Montañas rusas", source: "Gemini_Generated_Image_7t7up17t7up17t7u.jpeg" },
  { id: "paises", label: "Países del mundo", source: "Gemini_Generated_Image_rp1pi3rp1pi3rp1p.jpeg" },
  { id: "safari", label: "Safari", source: "Gemini_Generated_Image_r9a6uor9a6uor9a6.jpeg" },
  { id: "dinosaurios", label: "Parque de dinosaurios", source: "Gemini_Generated_Image_7t2cwb7t2cwb7t2c.jpeg" },
  { id: "parque-acuatico", label: "Parque acuático", source: "Gemini_Generated_Image_84noos84noos84no.jpeg" },
  { id: "playa", label: "Playa y surf", source: "Gemini_Generated_Image_bo3drlbo3drlbo3d.jpeg" },
  { id: "juguetes", label: "Cuarto de juguetes", source: "Gemini_Generated_Image_km9xi3km9xi3km9x.jpeg" },
  { id: "dalmatas", label: "Parque de dálmatas", source: "Gemini_Generated_Image_a8l9uga8l9uga8l9.jpeg" },
  { id: "dragones", label: "Dragones", source: "Gemini_Generated_Image_8d01us8d01us8d01.jpeg" },
  { id: "tren-magia", label: "Tren a la escuela de magia", source: "Gemini_Generated_Image_tmilv3tmilv3tmil.jpeg", temporal: true },
  { id: "escuela-magia", label: "Escuela de magia", source: "Gemini_Generated_Image_r0luvnr0luvnr0lu.jpeg", temporal: true },
  { id: "superheroe", label: "Superhéroe en la ciudad", source: "Gemini_Generated_Image_chd4oachd4oachd4.jpeg", temporal: true },
  { id: "carreras", label: "Carrera de autos", source: "Gemini_Generated_Image_9sqvu19sqvu19sqv.jpeg", temporal: true },
  { id: "batalla-galactica", label: "Batalla galáctica", source: "Gemini_Generated_Image_c2u2yic2u2yic2u2.jpeg", temporal: true },
  { id: "naves", label: "Naves espaciales", source: "Gemini_Generated_Image_u9f1lju9f1lju9f1.jpeg", temporal: true },
];

export const characterSrc = (id: string) => `/media/personajes/${id}.webp`;
export const bannerSrc = (id: string, size: "lg" | "sm" = "lg") => `/media/banners/${id}${size === "sm" ? "-sm" : ""}.webp`;

export function bannerItem(id: string | null | undefined) {
  return (id && BANNERS.find((b) => b.id === id)) || null;
}
