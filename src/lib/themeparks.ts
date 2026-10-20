// Cliente de la API de ThemeParks.wiki (https://api.themeparks.wiki/docs/v1): horarios por fecha de los
// parques (con los ingresos anticipados, los eventos con entrada aparte y los precios de Lightning Lane)
// y, para el catálogo, las atracciones y restaurantes de cada resort con su estado y su historial.
// No necesita clave (con THEMEPARKS_API_KEY el historial llega más atrás). Condiciones de uso: mostrar el crédito
// "Powered by ThemeParks.wiki" donde se vean sus datos (components/themeparks.tsx) y no dejar que se
// exporten en bloque.
import "server-only";
import type { Destination } from "@/generated/prisma/enums";

const BASE = "https://api.themeparks.wiki/v1";

/** Resorts de la API por destino del CRM (por su slug, que no cambia). */
export const THEMEPARKS_DESTINATIONS: Partial<Record<Destination, string>> = {
  DISNEY_WORLD: "waltdisneyworldresort",
  DISNEYLAND: "disneylandresort",
  DISNEYLAND_PARIS: "dlp",
  UNIVERSAL_ORLANDO: "universalresort_orlando",
  UNIVERSAL_HOLLYWOOD: "universalresort_hollywood",
};

export type ApiPark = { id: string; name: string; destination: Destination };

export type ApiScheduleEntry = {
  date: string; // YYYY-MM-DD
  type: "OPERATING" | "TICKETED_EVENT" | "PRIVATE_EVENT" | "EXTRA_HOURS" | "INFO";
  description?: string;
  openingTime: string; // ISO con el huso del parque: "2026-10-20T09:00:00-04:00"
  closingTime: string;
  purchases?: { id: string; name: string; type: "ADMISSION" | "PACKAGE" | "ATTRACTION"; price?: { formatted?: string }; available?: boolean }[];
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    headers: process.env.THEMEPARKS_API_KEY ? { "x-api-key": process.env.THEMEPARKS_API_KEY } : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`ThemeParks.wiki respondió ${res.status} en ${path}`);
  return res.json() as Promise<T>;
}

/** Los parques de los destinos que cubre la API, con su id. */
export async function apiParks(): Promise<ApiPark[]> {
  const { destinations } = await get<{ destinations: { id: string; slug: string; parks: { id: string; name: string }[] }[] }>("/destinations");
  const bySlug = new Map(Object.entries(THEMEPARKS_DESTINATIONS).map(([d, slug]) => [slug, d as Destination]));
  return destinations.flatMap((d) => {
    const destination = bySlug.get(d.slug);
    return destination ? d.parks.map((p) => ({ id: p.id, name: p.name, destination })) : [];
  });
}

/** Horarios de un mes de todos los parques de un resort: un pedido por mes para todo el destino. */
export async function resortSchedule(slug: string, year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const res = await get<{ parks?: { id: string; name: string; schedule: ApiScheduleEntry[] }[] }>(`/entity/${slug}/schedule/${year}/${mm}`);
  return res.parks ?? [];
}

export type ApiEntity = {
  id: string;
  name: string;
  entityType: "PARK" | "ATTRACTION" | "SHOW" | "RESTAURANT" | "HOTEL";
  /** El parque, o el resort si está fuera de los parques (Disney Springs, hoteles). */
  parentId: string | null;
};

/** Atracciones, shows y restaurantes de un resort (todo el árbol). */
export async function resortEntities(slug: string) {
  return (await get<{ children: ApiEntity[] }>(`/entity/${slug}/children`)).children;
}

export type ApiStatus = "OPERATING" | "DOWN" | "CLOSED" | "REFURBISHMENT";

/** Estado actual de cada entidad del resort (por id). La API no manda las que no tienen datos. */
export async function resortStatus(slug: string) {
  const { liveData } = await get<{ liveData: { id: string; status?: ApiStatus }[] }>(`/entity/${slug}/live`);
  return new Map(liveData.filter((l) => l.status).map((l) => [l.id, l.status!]));
}

export type ApiDailyRow = { date: string; operatingMinutes?: number; standby?: { p50?: number } };

/**
 * Resumen por día de cada entidad de un parque: minutos funcionando y esperas. Fechas del parque,
 * dentro del alcance del historial (7 días sin clave). Cuenta para el límite por hora del historial.
 */
export async function parkDailyHistory(parkId: string, from: string, to: string) {
  const res = await get<{ entities?: { id: string; days: ApiDailyRow[] }[] }>(`/entity/${parkId}/history/daily?from=${from}&to=${to}`);
  return new Map((res.entities ?? []).map((e) => [e.id, e.days]));
}

/** "2026-10-20T09:00:00-04:00" → "09:00" (la hora local del parque, tal como viene). */
export const localTime = (iso: string) => iso.slice(11, 16);
