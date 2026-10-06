import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";
import { AT_RISK_MONTHS, tierFor } from "@/lib/clients";
import { formatDate, money } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";
import clsx from "clsx";

export const metadata = { title: "Clientes" };

const SMART_LISTS = [
  { key: "", label: "Todos" },
  { key: "proximos", label: "Con viaje próximo" },
  { key: "sin-reserva", label: "Sin viajes" },
  { key: "reactivar", label: `Para reactivar (+${AT_RISK_MONTHS} meses)` },
  { key: "portal", label: "Sin portal activado" },
];

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; lista?: string }>;
}) {
  const user = await requireUser();
  const { q = "", tag = "", lista = "" } = await searchParams;
  const today = new Date();

  const where: Prisma.ClientWhereInput = { organizationId: user.organizationId };
  const and: Prisma.ClientWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { tags: { has: q } },
      ],
    });
  }
  if (tag) and.push({ tags: { has: tag } });
  if (lista === "proximos") and.push({ bookings: { some: { startDate: { gte: today }, status: { not: "CANCELLED" } } } });
  if (lista === "sin-reserva") and.push({ bookings: { none: {} } });
  if (lista === "portal") and.push({ account: null });
  if (lista === "reactivar") {
    const limit = new Date();
    limit.setMonth(limit.getMonth() - AT_RISK_MONTHS);
    and.push({ bookings: { some: {} } });
    and.push({ bookings: { none: { createdAt: { gte: limit } } } });
  }
  if (and.length) where.AND = and;

  const [clients, allTags] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        account: { select: { id: true } },
        bookings: {
          select: { totalPrice: true, status: true, startDate: true, createdAt: true },
        },
      },
      take: 500,
    }),
    db.client.findMany({ where: { organizationId: user.organizationId }, select: { tags: true } }),
  ]);
  const tags = [...new Set(allTags.flatMap((c) => c.tags))].sort();

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${clients.length} cliente${clients.length === 1 ? "" : "s"}`}
        actions={<LinkButton href="/app/clientes/nuevo">Nuevo cliente</LinkButton>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form className="relative min-w-64 flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Buscar por nombre, email, teléfono o etiqueta" className="field pl-9" />
          {lista && <input type="hidden" name="lista" value={lista} />}
        </form>
        <div className="flex flex-wrap gap-1.5">
          {SMART_LISTS.map((l) => (
            <Link
              key={l.key}
              href={`/app/clientes?lista=${l.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-medium",
                lista === l.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      {tags.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500">Etiquetas:</span>
          {tags.map((t) => (
            <Link
              key={t}
              href={tag === t ? "/app/clientes" : `/app/clientes?tag=${encodeURIComponent(t)}`}
              className={clsx("rounded-full px-2 py-0.5", tag === t ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {clients.length === 0 ? (
        <EmptyState
          title="No hay clientes para mostrar"
          description={q || lista || tag ? "Probá con otro filtro." : "Cargá tu primer cliente o compartí tu formulario de cotización."}
          action={<LinkButton href="/app/clientes/nuevo">Nuevo cliente</LinkButton>}
        />
      ) : (
        <Card>
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Nombre</Th>
                <Th>Contacto</Th>
                <Th>Etiquetas</Th>
                <Th className="text-right">Viajes</Th>
                <Th className="text-right">Valor total</Th>
                <Th>Próximo viaje</Th>
                <Th>Portal</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => {
                const sold = c.bookings.filter((b) => !["INQUIRY", "QUOTED", "CANCELLED"].includes(b.status));
                const value = sold.reduce((s, b) => s + Number(b.totalPrice), 0);
                const tier = tierFor(value);
                const next = c.bookings
                  .filter((b) => b.startDate && b.startDate >= today && b.status !== "CANCELLED")
                  .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())[0];
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/app/clientes/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {c.firstName} {c.lastName}
                      </Link>
                      {tier && <Badge className={clsx("ml-2", tier.className)}>{tier.name}</Badge>}
                    </Td>
                    <Td className="text-xs">
                      <div>{c.email ?? "—"}</div>
                      <div className="text-slate-500">{c.phone}</div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => (
                          <Badge key={t}>{t}</Badge>
                        ))}
                        {c.tags.length > 3 && <span className="text-xs text-slate-400">+{c.tags.length - 3}</span>}
                      </div>
                    </Td>
                    <Td className="text-right">{sold.length}</Td>
                    <Td className="text-right">{value ? money(value) : "—"}</Td>
                    <Td className="text-xs">{next ? formatDate(next.startDate) : "—"}</Td>
                    <Td>{c.account ? <Badge className="bg-emerald-100 text-emerald-800">Activo</Badge> : <span className="text-xs text-slate-400">No</span>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
