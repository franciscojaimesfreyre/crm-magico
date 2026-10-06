import Link from "next/link";
import { revalidatePath } from "next/cache";
import clsx from "clsx";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Notificaciones" };

async function markAllRead() {
  "use server";
  const user = await requireUser();
  await db.notification.updateMany({
    where: { organizationId: user.organizationId, clientAccountId: null, readAt: null, OR: [{ userId: user.id }, { userId: null }] },
    data: { readAt: new Date() },
  });
  revalidatePath("/app", "layout");
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({
    where: { organizationId: user.organizationId, clientAccountId: null, OR: [{ userId: user.id }, { userId: null }] },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader
        title="Notificaciones"
        actions={
          items.some((n) => !n.readAt) && (
            <form action={markAllRead}>
              <button className="text-sm text-brand-700 hover:underline">Marcar todo como leído</button>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState title="Sin notificaciones" description="Acá vas a ver consultas nuevas, mensajes, cotizaciones aceptadas y más." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "/app"} className={clsx("block px-5 py-3 hover:bg-slate-50", !n.readAt && "bg-brand-50/50")}>
                  <p className={clsx("text-sm", n.readAt ? "text-slate-700" : "font-medium text-slate-900")}>{n.title}</p>
                  {n.body && <p className="truncate text-xs text-slate-500">{n.body}</p>}
                  <p className="text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
