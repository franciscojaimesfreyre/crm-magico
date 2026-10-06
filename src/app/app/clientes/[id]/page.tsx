import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRound, Mail, MapPin, Phone, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, EmptyState, Field, Input, LinkButton, PageHeader, Select, Tabs } from "@/components/ui";
import {
  BOOKING_STATUS_COLOR,
  BOOKING_STATUS_LABEL,
  BUDGET_LEVEL_LABEL,
  CLIENT_SOURCE_LABEL,
  DESTINATION_LABEL,
  TRIP_PACE_LABEL,
} from "@/lib/labels";
import { ageOn, formatDate, formatDateTime, formatRange, money } from "@/lib/format";
import { tierFor } from "@/lib/clients";
import {
  addSupplierLogin,
  addTraveler,
  deleteClient,
  deleteSupplierLogin,
  deleteTraveler,
  regenerateInviteCode,
  sendClientEmail,
  sendPortalInvite,
  updateTraveler,
} from "../actions";
import { CopyText, RevealPassword, TemplatePicker } from "./client-widgets";
import { TravelerForm } from "./traveler-form";

const TABS = [
  { key: "viajes", label: "Viajes" },
  { key: "viajeros", label: "Viajeros" },
  { key: "accesos", label: "Accesos" },
  { key: "email", label: "Enviar email" },
  { key: "actividad", label: "Actividad" },
];

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "viajes" } = await searchParams;
  const user = await requireUser();
  const client = await db.client.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      owner: true,
      account: true,
      referredBy: true,
      referrals: { select: { id: true, firstName: true, lastName: true } },
      travelers: { orderBy: { createdAt: "asc" } },
      bookings: { orderBy: { startDate: "desc" } },
      supplierLogins: { orderBy: { supplier: "asc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } },
    },
  });
  if (!client) notFound();

  const sold = client.bookings.filter((b) => !["INQUIRY", "QUOTED", "CANCELLED"].includes(b.status));
  const lifetime = sold.reduce((s, b) => s + Number(b.totalPrice), 0);
  const tier = tierFor(lifetime);
  const templates = tab === "email"
    ? await db.emailTemplate.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } })
    : [];
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return (
    <>
      <PageHeader
        back={{ href: "/app/clientes", label: "Clientes" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {client.firstName} {client.lastName}
            {tier && <Badge className={tier.className}>{tier.name}</Badge>}
            {client.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </span>
        }
        description={`Cliente desde ${formatDate(client.createdAt)} · ${CLIENT_SOURCE_LABEL[client.source]}`}
        actions={
          <>
            <LinkButton variant="secondary" href={`/app/clientes/${id}/editar`}>
              Editar
            </LinkButton>
            <LinkButton href={`/app/viajes/nueva?clientId=${id}`}>Nuevo viaje</LinkButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Tabs
            active={tab}
            tabs={TABS.map((t) => ({
              ...t,
              href: `/app/clientes/${id}?tab=${t.key}`,
              count: t.key === "viajes" ? client.bookings.length : t.key === "viajeros" ? client.travelers.length : t.key === "accesos" ? client.supplierLogins.length : undefined,
            }))}
          />

          {tab === "viajes" &&
            (client.bookings.length === 0 ? (
              <EmptyState
                title="Todavía no tiene viajes"
                action={<LinkButton href={`/app/viajes/nueva?clientId=${id}`}>Crear viaje</LinkButton>}
              />
            ) : (
              <div className="space-y-3">
                {client.bookings.map((b) => (
                  <Link key={b.id} href={`/app/viajes/${b.id}`} className="block">
                    <Card className="flex flex-wrap items-center justify-between gap-3 p-4 hover:border-brand-200">
                      <div>
                        <p className="font-medium text-slate-900">
                          {b.title} <span className="text-xs text-slate-400">{b.code}</span>
                        </p>
                        <p className="text-sm text-slate-500">
                          {DESTINATION_LABEL[b.destination]} · {formatRange(b.startDate, b.endDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{money(b.totalPrice, b.currency)}</span>
                        <Badge className={BOOKING_STATUS_COLOR[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            ))}

          {tab === "viajeros" && (
            <div className="space-y-4">
              {client.travelers.map((t) => {
                const age = ageOn(t.birthDate);
                return (
                  <Card key={t.id}>
                    <details>
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4">
                        <div>
                          <p className="font-medium text-slate-900">
                            {t.firstName} {t.lastName}
                            {t.relationship && <span className="ml-2 text-xs text-slate-500">{t.relationship}</span>}
                          </p>
                          <p className="text-xs text-slate-500">
                            {[
                              age !== null && `${age} años`,
                              t.heightCm && `${t.heightCm} cm`,
                              t.dietaryNotes,
                              t.accessibilityNotes,
                              t.passportExpiry && `Pasaporte vence ${formatDate(t.passportExpiry)}`,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Sin datos adicionales"}
                          </p>
                        </div>
                        <span className="text-xs text-brand-700">Editar</span>
                      </summary>
                      <div className="border-t border-slate-100 p-4">
                        <TravelerForm action={updateTraveler.bind(null, t.id)} traveler={t} submitLabel="Guardar" />
                        <form action={deleteTraveler.bind(null, t.id)} className="mt-3">
                          <ConfirmButton message={`¿Eliminar a ${t.firstName}?`}>
                            <Trash2 className="size-3.5" /> Eliminar viajero
                          </ConfirmButton>
                        </form>
                      </div>
                    </details>
                  </Card>
                );
              })}
              <Card>
                <CardHeader title="Agregar viajero" description="Edad y altura ayudan a la IA a elegir atracciones aptas." />
                <div className="p-4">
                  <TravelerForm action={addTraveler.bind(null, id)} submitLabel="Agregar" />
                </div>
              </Card>
            </div>
          )}

          {tab === "accesos" && (
            <div className="space-y-4">
              <Card>
                <CardHeader
                  title="Accesos a portales de proveedores"
                  description="MyDisney, Universal, navieras… Se guardan cifrados y cada vez que alguien ve una contraseña queda registrado."
                />
                {client.supplierLogins.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">No hay accesos guardados.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {client.supplierLogins.map((l) => (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                        <div>
                          <p className="flex items-center gap-2 font-medium text-slate-900">
                            <KeyRound className="size-4 text-slate-400" /> {l.supplier}
                          </p>
                          <p className="text-sm text-slate-600">{l.username}</p>
                          {l.notes && <p className="text-xs text-slate-400">{l.notes}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <RevealPassword loginId={l.id} />
                          <form action={deleteSupplierLogin.bind(null, l.id)}>
                            <ConfirmButton message="¿Eliminar este acceso?" variant="ghost">
                              <Trash2 className="size-3.5" />
                            </ConfirmButton>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <CardHeader title="Guardar acceso" />
                <ActionForm action={addSupplierLogin.bind(null, id)} resetOnSuccess className="grid gap-3 p-4 sm:grid-cols-2">
                  <Field label="Proveedor">
                    <Select
                      name="supplier"
                      options={["MyDisney", "Universal Orlando", "Disney Cruise Line", "Royal Caribbean", "Carnival", "Booking", "Rentadora de autos", "Otro"].map((s) => ({ value: s, label: s }))}
                    />
                  </Field>
                  <Field label="Usuario / email">
                    <Input name="username" required />
                  </Field>
                  <Field label="Contraseña">
                    <Input name="password" type="password" autoComplete="new-password" required />
                  </Field>
                  <Field label="Notas">
                    <Input name="notes" />
                  </Field>
                  <div className="sm:col-span-2">
                    <SubmitButton>Guardar acceso</SubmitButton>
                  </div>
                </ActionForm>
              </Card>
            </div>
          )}

          {tab === "email" && (
            <Card>
              <CardHeader title="Enviar email" description={client.email ? `Para: ${client.email}` : "El cliente no tiene email cargado."} />
              <ActionForm action={sendClientEmail.bind(null, id)} className="space-y-3 p-5">
                {client.bookings.length > 0 && (
                  <Field label="Viaje relacionado (para completar variables)">
                    <Select name="bookingId" placeholder="Ninguno" options={client.bookings.map((b) => ({ value: b.id, label: `${b.code} · ${b.title}` }))} />
                  </Field>
                )}
                <TemplatePicker templates={templates} />
                <SubmitButton disabled={!client.email} pendingText="Enviando…">
                  Enviar
                </SubmitButton>
              </ActionForm>
            </Card>
          )}

          {tab === "actividad" && (
            <Card>
              {client.activities.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">Sin actividad registrada.</p>
              ) : (
                <ol className="divide-y divide-slate-100">
                  {client.activities.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                      <span className="text-slate-700">{a.description}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatDateTime(a.createdAt)}
                        {a.user && ` · ${a.user.name}`}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="space-y-2 p-4 text-sm">
            {client.email && (
              <p className="flex items-center gap-2 text-slate-700">
                <Mail className="size-4 text-slate-400" /> {client.email}
              </p>
            )}
            {client.phone && (
              <p className="flex items-center gap-2 text-slate-700">
                <Phone className="size-4 text-slate-400" />
                <a href={`https://wa.me/${client.phone.replace(/\D/g, "")}`} target="_blank" className="hover:text-brand-700">
                  {client.phone}
                </a>
              </p>
            )}
            {(client.city || client.country) && (
              <p className="flex items-center gap-2 text-slate-700">
                <MapPin className="size-4 text-slate-400" /> {[client.city, client.country].filter(Boolean).join(", ")}
              </p>
            )}
            <p className="text-xs text-slate-500">Valor total vendido: {money(lifetime)}</p>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-900">Portal del viajero</h3>
            {client.account ? (
              <p className="mt-1 text-sm text-emerald-700">
                Activo desde {formatDate(client.account.createdAt)}
                {client.account.lastLoginAt && <span className="block text-xs text-slate-500">Último ingreso: {formatDateTime(client.account.lastLoginAt)}</span>}
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-slate-500">Código de invitación:</p>
                <p className="mt-1 font-mono text-2xl font-semibold tracking-widest text-brand-700">{client.inviteCode}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <CopyText text={`${appUrl}/portal/registro?codigo=${client.inviteCode}`} label="Copiar link" />
                  <form action={regenerateInviteCode.bind(null, id)}>
                    <button className="text-xs text-slate-500 hover:underline">Generar otro</button>
                  </form>
                </div>
                <ActionForm action={sendPortalInvite.bind(null, id)} className="mt-3">
                  <SubmitButton size="sm" variant="secondary" disabled={!client.email} pendingText="Enviando…">
                    Enviar invitación por email
                  </SubmitButton>
                </ActionForm>
              </>
            )}
          </Card>

          <Card className="space-y-2 p-4 text-sm">
            <h3 className="font-semibold text-slate-900">Preferencias</h3>
            <dl className="space-y-1.5 text-xs">
              {client.pace && <Pref label="Ritmo" value={TRIP_PACE_LABEL[client.pace]} />}
              {client.budgetLevel && <Pref label="Presupuesto" value={BUDGET_LEVEL_LABEL[client.budgetLevel]} />}
              {client.interests.length > 0 && <Pref label="Intereses" value={client.interests.join(", ")} />}
              {client.favoriteParks.length > 0 && <Pref label="Parques favoritos" value={client.favoriteParks.join(", ")} />}
              {client.dietaryNotes && <Pref label="Alimentación" value={client.dietaryNotes} />}
              {client.accessibilityNotes && <Pref label="Accesibilidad" value={client.accessibilityNotes} />}
              {client.previousVisits && <Pref label="Visitas anteriores" value={client.previousVisits} />}
              {client.preferenceNotes && <Pref label="Notas" value={client.preferenceNotes} />}
            </dl>
            {!client.pace && client.interests.length === 0 && (
              <p className="text-xs text-slate-400">
                Sin preferencias cargadas.{" "}
                <Link href={`/app/clientes/${id}/editar`} className="text-brand-700 hover:underline">
                  Completarlas
                </Link>{" "}
                mejora las propuestas de la IA.
              </p>
            )}
          </Card>

          {client.notes && (
            <Card className="p-4 text-sm">
              <h3 className="font-semibold text-slate-900">Notas internas</h3>
              <p className="mt-1 whitespace-pre-line text-slate-600">{client.notes}</p>
            </Card>
          )}

          {(client.referredBy || client.referrals.length > 0) && (
            <Card className="space-y-1 p-4 text-sm">
              <h3 className="font-semibold text-slate-900">Referidos</h3>
              {client.referredBy && (
                <p className="text-xs text-slate-600">
                  Llegó referido por{" "}
                  <Link className="text-brand-700 hover:underline" href={`/app/clientes/${client.referredBy.id}`}>
                    {client.referredBy.firstName} {client.referredBy.lastName}
                  </Link>
                </p>
              )}
              {client.referrals.length > 0 && (
                <p className="text-xs text-slate-600">
                  Refirió a:{" "}
                  {client.referrals.map((r, i) => (
                    <span key={r.id}>
                      {i > 0 && ", "}
                      <Link className="text-brand-700 hover:underline" href={`/app/clientes/${r.id}`}>
                        {r.firstName} {r.lastName}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </Card>
          )}

          <form action={deleteClient.bind(null, id)}>
            <ConfirmButton message="¿Eliminar este cliente con todos sus viajes, mensajes y documentos? No se puede deshacer.">
              <Trash2 className="size-3.5" /> Eliminar cliente
            </ConfirmButton>
          </form>
        </aside>
      </div>
    </>
  );
}

function Pref({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}
