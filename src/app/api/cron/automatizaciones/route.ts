import { db } from "@/lib/db";
import { runDateWorkflows } from "@/lib/automations";

/**
 * Corre las automatizaciones por fecha de todas las organizaciones.
 * Programarlo una vez por día (Vercel Cron, crontab, etc.) con el header
 * `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("No autorizado", { status: 401 });
  }
  const orgs = await db.organization.findMany({ select: { id: true } });
  let executed = 0;
  for (const org of orgs) executed += await runDateWorkflows(org.id);
  return Response.json({ organizations: orgs.length, executed });
}
