// Utilidades de clientes compartidas (sin dependencias de servidor).

export const INTEREST_OPTIONS = [
  "Atracciones intensas",
  "Atracciones para chicos",
  "Personajes",
  "Princesas",
  "Shows y desfiles",
  "Fuegos artificiales",
  "Star Wars",
  "Marvel",
  "Pixar",
  "Harry Potter",
  "Nintendo",
  "Gastronomía",
  "Compras",
  "Parques acuáticos",
  "Pileta y descanso",
  "Fotos",
  "Animales",
];

export type Tier = { name: "Platinum" | "Gold" | "Silver" | "Bronze"; className: string };

/** Nivel del cliente según el valor total vendido (en la moneda principal). */
export function tierFor(lifetimeValue: number): Tier | null {
  if (lifetimeValue >= 30000) return { name: "Platinum", className: "bg-slate-800 text-white" };
  if (lifetimeValue >= 15000) return { name: "Gold", className: "bg-amber-100 text-amber-800" };
  if (lifetimeValue >= 5000) return { name: "Silver", className: "bg-slate-200 text-slate-700" };
  if (lifetimeValue > 0) return { name: "Bronze", className: "bg-orange-100 text-orange-800" };
  return null;
}

/** Meses sin reservar a partir de los cuales se marca al cliente "para reactivar". */
export const AT_RISK_MONTHS = 18;

export function splitList(value: FormDataEntryValue | null | undefined) {
  if (!value || typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
