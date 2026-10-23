import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, FileText, Link2, Pencil, Trash2, Wand2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, Checkbox, EmptyState, Field, Input, LinkButton, Select, Tabs, buttonClass } from "@/components/ui";
import { Chat } from "@/components/chat";
import { ItineraryView } from "@/components/itinerary-view";
import { bookingClosures } from "@/lib/catalog";
import { TaskList } from "@/components/task-list";
import { TaskForm } from "@/components/task-form";
import { BOOKING_STATUSES, CONTRACT_STATUS_COLOR, CONTRACT_STATUS_LABEL, ITEM_TYPE_BASE, ITEM_TYPE_LABEL } from "@/lib/labels";
import { fileSize, formatDate, formatDateTime, toDateInput, toNumber } from "@/lib/format";
import { TripHeader } from "./trip-header";
import { loadThread } from "@/lib/messages";
import { cancelBooking, deleteBooking, setBookingStatus } from "../actions";
import { StatusSelect } from "@/components/status-select";
import { addBookingDocument, attachFromLibrary, deleteDocument, toggleDocumentVisibility } from "@/app/app/documentos/actions";
import { readThread, sendAgentMessage } from "@/app/app/mensajes/actions";
import { CopyText } from "@/app/app/clientes/[id]/client-widgets";
import { loadBooking } from "./data";
import { Summary } from "./summary";
import { Items } from "./items";
import { Quotes } from "./quotes";
import { appUrl } from "@/lib/app-url";
import { FileUpload } from "@/components/file-upload";
import { storageMode } from "@/lib/storage";
import { tripKnowledgeAlerts } from "@/lib/knowledge-alerts";
import { eventGuideFor, guideOptions } from "@/lib/park-guides";
import { eventDateWarning } from "@/lib/park-sheet";
import type { ItemType } from "@/generated/prisma/enums";
import { avatarImages } from "@/lib/avatars-server";
import { ShareAccessButton } from "@/components/share-access";
import { regenerateInviteCode, sendPortalInvite } from "@/app/app/clientes/actions";

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "reservas", label: "Reservas" },
  { key: "cotizaciones", label: "Cotizaciones" },
  { key: "itinerario", label: "Itinerario" },
  { key: "documentos", label: "Documentos" },
  { key: "mensajes", label: "Mensajes" },
  { key: "tareas", label: "Tareas" },
  { key: "actividad", label: "Actividad" },
];

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "resumen" } = await searchParams;
  const user = await requireUser();
  const b = await loadBooking(id, user.organizationId);
  if (!b) notFound();
  const defaultRate = toNumber(user.organization.agency?.defaultCommissionRate ?? user.organization.defaultCommissionRate);
  const baseUrl = appUrl();

  return (
    <>
      <Link href="/app/viajes" className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-slate-900">
        <ChevronLeft className="size-4" /> Viajes
      </Link>
      <TripHeader
        booking={b}
        actions={
          <>
            <StatusSelect action={setBookingStatus.bind(null, b.id) as (status: string) => Promise<void>} value={b.status} options={BOOKING_STATUSES} />
            <ShareAccessButton
              firstName={b.client.firstName}
              email={b.client.email}
              inviteCode={b.client.inviteCode}
              registerUrl={`${baseUrl}/portal/registro?codigo=${b.client.inviteCode}`}
              tripUrl={`${baseUrl}/portal/viajes/${b.id}`}
              account={
                b.client.account
                  ? { since: formatDate(b.client.account.createdAt), lastLogin: b.client.account.lastLoginAt ? formatDateTime(b.client.account.lastLoginAt) : null }
                  : null
              }
              regenerate={regenerateInviteCode.bind(null, b.clientId)}
              sendInvite={sendPortalInvite.bind(null, b.clientId)}
            />
            <LinkButton href={`/app/viajes/${b.id}/editar`}>
              <Pencil className="size-4" /> Editar viaje
            </LinkButton>
          </>
        }
      />
      {b.status === "CANCELLED" && b.cancelReason && (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">Cancelada: {b.cancelReason}</p>
      )}

      <Tabs
        active={tab}
        tabs={TABS.map((t) => ({
          ...t,
          href: `/app/viajes/${b.id}?tab=${t.key}`,
          count:
            t.key === "reservas" ? b.items.length
            : t.key === "cotizaciones" ? b.quotes.length
            : t.key === "itinerario" ? b._count.days
            : t.key === "documentos" ? b._count.documents
            : t.key === "mensajes" ? b._count.messages
            : t.key === "tareas" ? b._count.tasks
            : undefined,
        }))}
      />

      {tab === "resumen" && (
        <>
          <Summary booking={b} alerts={await tripKnowledgeAlerts(b)} gallery={await avatarImages(user.organizationId)} />
          <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
            {b.status !== "CANCELLED" && (
              <form action={cancelBooking.bind(null, b.id)} className="flex items-center gap-2">
                <Input name="cancelReason" placeholder="Motivo de cancelación" className="w-64" />
                <ConfirmButton message="¿Cancelar este viaje?">Cancelar viaje</ConfirmButton>
              </form>
            )}
            <form action={deleteBooking.bind(null, b.id)}>
              <ConfirmButton message="¿Eliminar definitivamente el viaje con todas sus reservas y su contenido?">
                <Trash2 className="size-3.5" /> Eliminar
              </ConfirmButton>
            </form>
          </div>
        </>
      )}

      {tab === "reservas" && <Items booking={b} defaultRate={defaultRate} eventWarnings={await eventWarnings(b.items)} />}
      {tab === "cotizaciones" && <Quotes booking={b} defaultRate={defaultRate} />}
      {tab === "itinerario" && <ItineraryTab bookingId={b.id} shareToken={b.shareToken} baseUrl={baseUrl} />}
      {tab === "documentos" && <DocumentsTab bookingId={b.id} organizationId={user.organizationId} />}
      {tab === "mensajes" && (
        <Card className="overflow-hidden">
          <CardHeader
            title={`Conversación con ${b.client.firstName}`}
            description={b.client.account ? "El cliente ve estos mensajes en su portal." : "El cliente todavía no activó su portal: va a ver los mensajes cuando lo active."}
          />
          <Chat
            className="h-[60vh] bg-slate-50"
            initial={await loadThread(b.clientId, b.id)}
            viewer="AGENT"
            send={sendAgentMessage.bind(null, b.clientId, b.id)}
            poll={readThread.bind(null, b.clientId, b.id)}
          />
        </Card>
      )}
      {tab === "tareas" && <TasksTab bookingId={b.id} organizationId={user.organizationId} />}
      {tab === "actividad" && <ActivityTab bookingId={b.id} />}
    </>
  );
}

/** Reservas de eventos especiales en una fecha que no figura entre las cargadas en la ficha del evento. */
async function eventWarnings(items: { id: string; type: ItemType; status: string; description: string; supplier: string | null; startDate: Date | null }[]) {
  const events = items.filter((i) => i.status !== "CANCELLED" && i.startDate && ITEM_TYPE_BASE[i.type] === "SPECIAL_EVENT");
  if (events.length === 0) return {};
  const guides = await guideOptions();
  return Object.fromEntries(
    events.flatMap((i) => {
      const g = eventGuideFor(i, guides);
      const warning = g && eventDateWarning(g, toDateInput(i.startDate));
      return warning ? [[i.id, warning]] : [];
    }),
  );
}

async function ItineraryTab({ bookingId, shareToken, baseUrl }: { bookingId: string; shareToken: string; baseUrl: string }) {
  const days = await db.itineraryDay.findMany({
    where: { bookingId },
    orderBy: { dayNumber: "asc" },
    include: { items: { orderBy: { position: "asc" } } },
  });
  const shareUrl = `${baseUrl}/i/${shareToken}`;
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 text-sm text-slate-600">
          El cliente ve el itinerario en su portal. También podés compartirlo con un link público (no requiere cuenta).
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link2 className="size-4 text-slate-500" />
            <code className="min-w-0 text-xs break-all">{shareUrl}</code>
            <CopyText text={shareUrl} />
            <a href={shareUrl} target="_blank" className="text-xs text-brand-700 hover:underline">
              <ExternalLink className="inline size-3.5" /> Ver
            </a>
          </div>
        </div>
        <LinkButton href={`/app/viajes/${bookingId}/itinerario`} variant={days.length ? "primary" : "magic"}>
          {days.length ? <Pencil className="size-4" /> : <Wand2 className="size-4" />}
          {days.length ? "Editar itinerario" : "Crear itinerario"}
        </LinkButton>
      </Card>
      {days.length === 0 ? (
        <EmptyState title="Sin itinerario" description="Armalo a mano arrastrando actividades o pedile a la IA una propuesta basada en el perfil de la familia y las últimas novedades." />
      ) : (
        <ItineraryView days={days} closures={await bookingClosures(bookingId)} />
      )}
    </div>
  );
}

async function DocumentsTab({ bookingId, organizationId }: { bookingId: string; organizationId: string }) {
  const [docs, library] = await Promise.all([
    db.document.findMany({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { name: true } }, bookingItem: { select: { type: true, description: true } } },
    }),
    db.libraryDocument.findMany({ where: { organizationId }, orderBy: [{ folder: "asc" }, { name: "asc" }] }),
  ]);
  const reservations = await db.bookingItem.findMany({ where: { bookingId }, orderBy: { position: "asc" }, select: { id: true, description: true } });
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader title="Documentos del viaje" description="Confirmaciones, vouchers, guías… Los visibles aparecen en el portal del cliente." />
        {docs.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Todavía no hay documentos.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-5 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <a
                      href={d.storageKey ? `/api/archivos/${d.id}` : (d.url ?? "#")}
                      target="_blank"
                      className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700"
                    >
                      {d.name}
                    </a>
                    {d.bookingItem && (
                      <Link href={`/app/viajes/${bookingId}?tab=reservas`} className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded bg-brand-50 px-1.5 py-px text-[11px] font-medium text-brand-700 hover:underline">
                        <span className="truncate">Reserva: {d.bookingItem.description}</span>
                        <span className="shrink-0 font-normal text-brand-600/70">· {ITEM_TYPE_LABEL[d.bookingItem.type]}</span>
                      </Link>
                    )}
                    <p className="text-xs text-slate-500">
                      {[d.storageKey ? fileSize(d.size) : "Link", formatDateTime(d.createdAt), d.uploadedBy?.name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <form action={toggleDocumentVisibility.bind(null, d.id)}>
                    <button className={buttonClass(d.visibleToClient ? "secondary" : "ghost", "sm")} title="Cambiar visibilidad">
                      {d.visibleToClient ? "Visible al cliente" : "Solo interno"}
                    </button>
                  </form>
                  <form action={deleteDocument.bind(null, d.id)}>
                    <ConfirmButton variant="ghost" message="¿Eliminar el documento?">
                      <Trash2 className="size-3.5" />
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Subir archivo o link" description="PDF, imágenes, Word, Excel… hasta 100 MB." />
          <ActionForm action={addBookingDocument.bind(null, bookingId)} resetOnSuccess className="space-y-3 p-4">
            <Field label="Archivo">
              <FileUpload direct={storageMode() === "r2"} />
            </Field>
            <Field label="…o link" hint="Canva, Google Docs, Drive…">
              <Input name="url" type="url" placeholder="https://" />
            </Field>
            <Field label="Nombre (opcional)">
              <Input name="name" />
            </Field>
            {reservations.length > 0 && (
              <Field label="Reserva (opcional)" hint="Voucher, recibo o confirmación de una reserva">
                <Select name="bookingItemId" options={reservations.map((r) => ({ value: r.id, label: r.description }))} placeholder="Del viaje en general" />
              </Field>
            )}
            <Checkbox name="visibleToClient" label="Visible para el cliente" defaultChecked />
            <SubmitButton pendingText="Subiendo…" className="w-full">
              Agregar
            </SubmitButton>
          </ActionForm>
        </Card>
        <Card>
          <CardHeader title="Desde la biblioteca" description="Documentos reutilizables (se copia el archivo)." />
          {library.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              Tu biblioteca está vacía.{" "}
              <Link href="/app/documentos" className="text-brand-700 hover:underline">
                Cargar documentos
              </Link>
            </p>
          ) : (
            <form action={attachFromLibrary.bind(null, bookingId)} className="flex gap-2 p-4">
              <Select name="libraryId" options={library.map((l) => ({ value: l.id, label: l.folder ? `${l.folder} / ${l.name}` : l.name }))} />
              <SubmitButton variant="secondary">Adjuntar</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

async function TasksTab({ bookingId, organizationId }: { bookingId: string; organizationId: string }) {
  const [tasks, agents, contracts] = await Promise.all([
    db.task.findMany({
      where: { bookingId },
      orderBy: [{ completedAt: { sort: "asc", nulls: "first" } }, { dueDate: { sort: "asc", nulls: "last" } }],
      include: { assignee: { select: { name: true } } },
    }),
    db.user.findMany({ where: { organizationId, active: true }, select: { id: true, name: true } }),
    db.contract.findMany({ where: { bookingId }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <TaskForm bookingId={bookingId} agents={agents.map((a) => ({ value: a.id, label: a.name }))} />
        <div className="border-t border-slate-100">
          <TaskList tasks={tasks} showContext={false} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Contratos" actions={<LinkButton size="sm" variant="secondary" href={`/app/contratos/nuevo?bookingId=${bookingId}`}>Nuevo</LinkButton>} />
        {contracts.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Sin contratos.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {contracts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <Link href={`/app/contratos/${c.id}`} className="text-slate-800 hover:text-brand-700">
                  {c.title}
                </Link>
                <Badge className={CONTRACT_STATUS_COLOR[c.status]}>{CONTRACT_STATUS_LABEL[c.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function ActivityTab({ bookingId }: { bookingId: string }) {
  const activities = await db.activity.findMany({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
    take: 100,
  });
  return (
    <Card>
      {activities.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">Sin actividad.</p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {activities.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
              <span className="text-slate-700">{a.description}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {formatDateTime(a.createdAt)}
                {a.user && ` · ${a.user.name}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
