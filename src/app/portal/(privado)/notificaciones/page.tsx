import Link from "next/link";
import clsx from "clsx";
import { db } from "@/lib/db";
import { requireClientAccount } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { markPortalNotificationsRead } from "../../actions";

export const metadata = { title: "Novedades" };

export default async function PortalNotifications() {
  const account = await requireClientAccount();
  const items = await db.notification.findMany({
    where: { clientAccountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = items.some((n) => !n.readAt);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Novedades</h1>
        {unread && (
          <form action={markPortalNotificationsRead}>
            <button className="text-sm text-brand-700 hover:underline">Marcar todo como leído</button>
          </form>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">No hay novedades por ahora.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.link ?? "/portal"} className={clsx("block px-4 py-3 hover:bg-slate-50", !n.readAt && "bg-brand-50/60")}>
                <p className={clsx("text-sm", n.readAt ? "text-slate-700" : "font-medium text-slate-900")}>{n.title}</p>
                {n.body && <p className="truncate text-xs text-slate-500">{n.body}</p>}
                <p className="text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
