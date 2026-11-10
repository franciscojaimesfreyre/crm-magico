import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, CheckCircle2, Copy, Pencil, Plus, Send, ThumbsDown, Trash2 } from "lucide-react";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Alert, Badge, Card, Checkbox, EmptyState, Field, Input, Select, buttonClass } from "@/components/ui";
import { ITEM_TYPE_LABEL, QUOTE_STATUS_COLOR, QUOTE_STATUS_LABEL, reservationStage } from "@/lib/labels";
import { formatDate, formatDateTime, formatRange, money, toDateInput, toNumber } from "@/lib/format";
import { ACCEPTANCE_CHANNELS, quoteExpired } from "@/lib/quotes";
import {
  addQuoteItem,
  addQuoteOption,
  createQuote,
  deleteQuote,
  deleteQuoteItem,
  deleteQuoteOption,
  duplicateQuote,
  markQuoteAccepted,
  markQuoteRejected,
  updateQuote,
  updateQuoteItem,
} from "../quote-actions";
import { ItemFields } from "./item-fields";
import { QuoteMessageEditor } from "./quote-message";
import type { LoadedBooking } from "./data";
import { commissionFor } from "@/lib/trips";
import { DateInput } from "@/components/date-input";
import { MultiFileUpload } from "@/components/file-upload";
import { AttachmentChips } from "@/components/attachment-chips";
import { storageMode } from "@/lib/storage";

type LoadedQuote = LoadedBooking["quotes"][number];

/**
 * Cotizaciones del viaje. Una cotización es una propuesta: se arma en una columna (servicios editables ahí
 * mismo, alternativas opcionales), se envía, y cuando el cliente acepta (desde el portal, o el agente lo
 * marca si respondió por WhatsApp o teléfono) la opción elegida pasa a Reservas, vinculada servicio por servicio.
 */
export function Quotes({ booking: b, defaultRate }: { booking: LoadedBooking; defaultRate: number }) {
  const newQuote = (
    <form action={createQuote.bind(null, b.id)}>
      <SubmitButton pendingText="Creando…">
        <Plus className="size-4" /> Nueva cotización
      </SubmitButton>
    </form>
  );

  if (b.quotes.length === 0) {
    return (
      <EmptyState
        title="Sin cotizaciones"
        description="Armá la propuesta con los servicios del viaje. El cliente la acepta desde su portal (o la marcás vos si te respondió por WhatsApp) y pasa sola a Reservas."
        action={newQuote}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">{newQuote}</div>
      {b.quotes.map((q) => (
        <QuoteCard key={q.id} quote={q} booking={b} defaultRate={defaultRate} />
      ))}
    </div>
  );
}

function QuoteCard({ quote: q, booking: b, defaultRate }: { quote: LoadedQuote; booking: LoadedBooking; defaultRate: number }) {
  const editable = q.status === "DRAFT" || q.status === "SENT";
  const expired = editable && quoteExpired(q);
  const accepted = q.status === "ACCEPTED";
  const filled = q.options.filter((o) => o.items.length > 0);
  // Otras cotizaciones del viaje que siguen en juego: al aceptar, el agente decide si esta las reemplaza o se suma.
  const others = b.quotes.filter((o) => o.id !== q.id && (o.status === "SENT" || o.status === "ACCEPTED"));
  // Reservas que salieron de esta cotización y siguen por reservar.
  const pendingReservations = q.options.flatMap((o) => o.items.flatMap((i) => i.reservations)).filter((r) => r.status === "PENDING").length;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{q.title}</h3>
          <p className="text-xs text-slate-500">
            Creada {formatDate(q.createdAt)}
            {q.sentAt && ` · Enviada ${formatDateTime(q.sentAt)}`}
            {q.validUntil && ` · Válida hasta ${formatDate(q.validUntil)}`}
            {q.respondedAt && ` · Respondida ${formatDateTime(q.respondedAt)}`}
          </p>
          {accepted && q.acceptedVia && (
            <p className="mt-1 text-sm text-slate-700">{q.acceptedVia === "portal" ? "La aceptó el cliente desde su portal." : `La marcaste como aceptada (respondió por ${q.acceptedVia}).`}</p>
          )}
          {q.clientComment && <p className="mt-1 text-sm text-slate-600">Comentario del cliente: “{q.clientComment}”</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={expired ? "bg-amber-100 text-amber-800" : QUOTE_STATUS_COLOR[q.status]}>{expired ? "Vencida" : QUOTE_STATUS_LABEL[q.status]}</Badge>
          <form action={duplicateQuote.bind(null, q.id)}>
            <SubmitButton size="sm" variant="ghost" title="Duplicar como borrador nuevo" pendingText="…">
              <Copy className="size-3.5" />
            </SubmitButton>
          </form>
          <form action={deleteQuote.bind(null, q.id)}>
            <ConfirmButton message="¿Eliminar esta cotización? Las reservas que ya salieron de ella quedan en el viaje." variant="ghost">
              <Trash2 className="size-3.5" />
            </ConfirmButton>
          </form>
        </div>
      </div>

      {expired && (
        <div className="px-5 pt-4">
          <Alert tone="warn">Venció el {formatDate(q.validUntil)}: el cliente ya no puede aceptarla desde el portal. Cambiá la fecha de validez y reenviala, o marcala como aceptada si te confirmó por otro canal.</Alert>
        </div>
      )}

      {accepted && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50/60 px-5 py-3">
          <p className="text-sm text-emerald-900">
            {pendingReservations > 0
              ? `Pasó a Reservas: ${pendingReservations} ${pendingReservations === 1 ? "queda" : "quedan"} por reservar con el proveedor.`
              : "Ya está en Reservas."}
          </p>
          <Link href={`/app/viajes/${b.id}?tab=reservas`} className={buttonClass(pendingReservations > 0 ? "primary" : "secondary", "sm")}>
            {pendingReservations > 0 ? `Ir a reservar (${pendingReservations})` : "Ver reservas"} <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Una columna: cada opción con sus servicios; las alternativas son opcionales. */}
      <div className="space-y-4 p-5">
        {q.options.map((o) => (
          <OptionBlock key={o.id} option={o} quote={q} booking={b} defaultRate={defaultRate} editable={editable} canDelete={q.options.length > 1} />
        ))}
        {editable && (
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
              <Plus className="size-3.5" /> Agregar una alternativa (ej. otro hotel)
            </summary>
            <ActionForm action={addQuoteOption.bind(null, q.id)} resetOnSuccess className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <Input name="name" placeholder="Ej: Opción Deluxe" required />
              <Input name="description" placeholder="Para quién conviene, qué la diferencia…" />
              <SubmitButton size="sm" variant="secondary">
                Agregar
              </SubmitButton>
            </ActionForm>
          </details>
        )}
      </div>

      {editable && (
        <>
          {/* Título, validez y mensaje, con el envío en el mismo formulario: lo que se escribe sale en el email. */}
          <ActionForm action={updateQuote.bind(null, q.id)} className="grid grid-cols-1 gap-3 border-t border-slate-100 p-5 sm:grid-cols-3">
            <Field label="Título" className="sm:col-span-2">
              <Input name="title" defaultValue={q.title} />
            </Field>
            <Field label="Válida hasta">
              <DateInput name="validUntil" defaultValue={toDateInput(q.validUntil)} />
            </Field>
            <div className="sm:col-span-3">
              <QuoteMessageEditor quoteId={q.id} initial={q.message ?? ""} single={q.options.length === 1} />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-3">
              <SubmitButton size="sm" name="intent" value="send" pendingText="Enviando…">
                <Send className="size-3.5" /> {q.status === "SENT" ? "Guardar y reenviar al cliente" : "Enviar al cliente"}
              </SubmitButton>
              <SubmitButton size="sm" variant="secondary" name="intent" value="save">
                Guardar sin enviar
              </SubmitButton>
            </div>
          </ActionForm>

          {/* Si el cliente respondió por otro canal. En un borrador, aceptar queda como opción secundaria. */}
          <div className="flex flex-wrap items-start gap-2 border-t border-slate-100 px-5 py-4">
            {filled.length > 0 && (
              <details className="group open:basis-full">
                <summary className={clsx(q.status === "SENT" ? buttonClass("secondary", "sm") : "cursor-pointer text-sm font-medium text-brand-700 hover:underline", "list-none")}>
                  {q.status === "SENT" ? (
                    <>
                      <CheckCircle2 className="size-3.5" /> Marcar aceptada
                    </>
                  ) : (
                    "¿Ya te la aceptó por WhatsApp o teléfono? Marcarla aceptada"
                  )}
                </summary>
                <ActionForm action={markQuoteAccepted.bind(null, q.id)} className="mt-2 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
                  <p className="text-xs text-slate-600 sm:col-span-3">Pasa a Reservas, por reservar, igual que si la aceptara desde el portal.</p>
                  {filled.length > 1 ? (
                    <Field label="Opción que aceptó">
                      <Select name="optionId" options={filled.map((o) => ({ value: o.id, label: o.name }))} defaultValue={filled[0].id} />
                    </Field>
                  ) : (
                    <input type="hidden" name="optionId" value={filled[0].id} />
                  )}
                  <Field label="Cómo te respondió">
                    <Select name="via" options={ACCEPTANCE_CHANNELS.map((c) => ({ value: c, label: c }))} defaultValue="WhatsApp" />
                  </Field>
                  <Field label="Comentario (opcional)" className={filled.length > 1 ? "" : "sm:col-span-2"}>
                    <Input name="comment" placeholder="Ej: quiere la habitación con vista" />
                  </Field>
                  {others.length > 0 && (
                    <div className="sm:col-span-3">
                      <Checkbox name="replace" label={`Reemplaza a ${others.map((o) => `"${o.title}"`).join(", ")} (si no, se suma a lo que ya hay)`} />
                    </div>
                  )}
                  <div className="sm:col-span-3">
                    <SubmitButton size="sm" pendingText="Pasando a reservas…">
                      <CheckCircle2 className="size-3.5" /> Aceptada: pasar a reservas
                    </SubmitButton>
                  </div>
                </ActionForm>
              </details>
            )}
            {q.status === "SENT" && (
              <details className="group open:basis-full">
                <summary className={clsx(buttonClass("ghost", "sm"), "list-none")}>
                  <ThumbsDown className="size-3.5" /> Marcar rechazada
                </summary>
                <ActionForm action={markQuoteRejected.bind(null, q.id)} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Field label="Qué te dijo (opcional)" className="min-w-60 flex-1">
                    <Input name="comment" placeholder="Ej: le pareció caro, prefiere otra fecha" />
                  </Field>
                  <SubmitButton size="sm" variant="secondary">
                    Marcar rechazada
                  </SubmitButton>
                </ActionForm>
              </details>
            )}
          </div>
        </>
      )}
      {!editable && q.message && (
        <details className="border-t border-slate-100">
          <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-slate-700">Mensaje que recibió el cliente</summary>
          <p className="px-5 pb-5 text-sm whitespace-pre-line text-slate-700">{q.message}</p>
        </details>
      )}
    </Card>
  );
}

function OptionBlock({
  option: o,
  quote: q,
  booking: b,
  defaultRate,
  editable,
  canDelete,
}: {
  option: LoadedQuote["options"][number];
  quote: LoadedQuote;
  booking: LoadedBooking;
  defaultRate: number;
  editable: boolean;
  canDelete: boolean;
}) {
  const directUpload = storageMode() === "r2";
  const total = o.items.reduce((s, i) => s + toNumber(i.price), 0);
  const commission = o.items.reduce((s, i) => s + commissionFor(i, defaultRate), 0);
  const accepted = q.acceptedOptionId === o.id;
  const dimmed = q.status === "ACCEPTED" && !accepted;
  const single = q.options.length === 1;
  return (
    <div className={clsx("rounded-xl", accepted ? "bg-emerald-50 p-4 ring-1 ring-emerald-300" : single ? "" : "p-4 ring-1 ring-slate-200", dimmed && "opacity-60")}>
      {(!single || o.description || accepted) && (
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-slate-900">
              {accepted && <CheckCircle2 className="size-4 text-emerald-700" />}
              {single ? (accepted ? "Aceptada" : o.name) : o.name}
              {accepted && !single && <span className="text-xs font-medium text-emerald-800">· aceptada</span>}
            </p>
            {o.description && <p className="text-xs text-slate-500">{o.description}</p>}
          </div>
          {editable && canDelete && (
            <form action={deleteQuoteOption.bind(null, o.id)}>
              <ConfirmButton variant="ghost" message={`¿Eliminar la opción "${o.name}"?`}>
                <Trash2 className="size-3.5" />
              </ConfirmButton>
            </form>
          )}
        </div>
      )}

      {o.items.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">Todavía no tiene servicios.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {o.items.map((i) => {
            const reservation = i.reservations[0];
            return (
              <li key={i.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500">{ITEM_TYPE_LABEL[i.type]}</span>
                    <p className="text-slate-800">{i.description}</p>
                    <p className="text-xs text-slate-500">
                      {[i.supplier, i.startDate && formatRange(i.startDate, i.endDate), i.depositAmount !== null && `Depósito ${money(i.depositAmount, b.currency)}`, i.notes]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <AttachmentChips docs={i.documents} removable={editable} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {accepted && reservation && <Badge className={reservationStage(reservation).color}>{reservationStage(reservation).label}</Badge>}
                    <span className="whitespace-nowrap tabular-nums">{money(i.price, b.currency)}</span>
                    {editable && (
                      <form action={deleteQuoteItem.bind(null, i.id)}>
                        <button className="text-slate-300 hover:text-rose-600" title="Quitar" aria-label={`Quitar ${i.description}`}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                {editable && (
                  <details className="mt-1">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                      <Pencil className="size-3" /> Editar
                    </summary>
                    <ActionForm action={updateQuoteItem.bind(null, i.id)} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                      <ItemFields item={i} defaultRate={defaultRate} currency={b.currency} withConfirmation={false} withDetails />
                      <div className="sm:col-span-4">
                        <span className="label">Adjuntos (PDF o imagen, los ve el cliente)</span>
                        <MultiFileUpload direct={directUpload} />
                      </div>
                      <div className="flex items-end">
                        <SubmitButton size="sm">Guardar</SubmitButton>
                      </div>
                    </ActionForm>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-2">
        {editable ? (
          <details className="group basis-full">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              <Plus className="size-3.5" /> Agregar servicio
            </summary>
            <ActionForm action={addQuoteItem.bind(null, o.id)} resetOnSuccess className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <ItemFields defaultRate={defaultRate} currency={b.currency} withConfirmation={false} withDetails />
              <div className="sm:col-span-4">
                <span className="label">Adjuntos (PDF o imagen, los ve el cliente)</span>
                <MultiFileUpload direct={directUpload} />
              </div>
              <div className="flex items-end">
                <SubmitButton size="sm">Agregar</SubmitButton>
              </div>
            </ActionForm>
          </details>
        ) : (
          <span />
        )}
        <p className="ml-auto text-right">
          <span className="font-semibold text-slate-900 tabular-nums">{money(total, b.currency)}</span>
          <span className="block text-xs text-emerald-700">Comisión {money(commission, b.currency)}</span>
        </p>
      </div>
    </div>
  );
}

