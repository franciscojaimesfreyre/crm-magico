import "server-only";
import { db } from "@/lib/db";

/** Opciones de selects compartidas por los formularios de reserva. */
export async function bookingFormOptions(organizationId: string) {
  const groups = await db.group.findMany({
    where: { organizationId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    select: { id: true, name: true },
    orderBy: { startDate: "asc" },
  });
  return {
    groups: groups.map((g) => ({ value: g.id, label: g.name })),
  };
}
