import { syncThemeParks } from "@/lib/themeparks-sync";

/**
 * Sincroniza con ThemeParks.wiki los horarios de las fichas de parques y el catálogo (cierres y esperas).
 * Programarlo una vez por día con el header `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("No autorizado", { status: 401 });
  }
  return Response.json(await syncThemeParks());
}
