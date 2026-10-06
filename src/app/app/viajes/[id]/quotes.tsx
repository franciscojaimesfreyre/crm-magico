import clsx from "clsx";
import { CheckCircle2, Plus, Send, Trash2 } from "lucide-react";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Badge, Card, EmptyState, Field, Input, Textarea } from "@/components/ui";
import { ITEM_TYPE_LABEL, QUOTE_STATUS_COLOR, QUOTE_STATUS_LABEL } from "@/lib/labels";
import { formatDate, formatDateTime, formatRange, money, toDateInput, toNumber } from "@/lib/format";
import {
  addQuoteItem,
  addQuoteOption,
  createQuote,
  deleteQuote,
  deleteQuoteItem,
  deleteQuoteOption,
  sendQuote,
  updateQuote,
} from "../quote-actions";
import { ItemFields } from "./item-fields";
import { QuoteMessageEditor } from "./quote-message";
import type { LoadedBooking } from "./data";

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
        description="Armá una cotización con una o varias opciones (por ejemplo, resort Value vs. Deluxe). El cliente la ve en su portal y la acepta con un clic."
        action={newQuote}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">{newQuote}</div>
      {b.quotes.map((q) => {
        const editable = q.status === "DRAFT" || q.status === "SENT";
        return (
          <Card key={q.id}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="font-semibold text-slate-900">{q.title}</h3>
                <p className="text-xs text-slate-500">
                  Creada {formatDate(q.createdAt)}
                  {q.sentAt && ` · Enviada ${formatDateTime(q.sentAt)}`}
                  {q.validUntil && ` · Válida hasta ${formatDate(q.validUntil)}`}
                  {q.respondedAt && ` · Respondida ${formatDateTime(q.respondedAt)}`}
                </p>
                {q.clientComment && <p className="mt-1 text-sm text-slate-600">Comentario del cliente: “{q.clientComment}”</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={QUOTE_STATUS_COLOR[q.status]}>{QUOTE_STATUS_LABEL[q.status]}</Badge>
                {editable && (
                  <ActionForm action={sendQuote.bind(null, q.id)}>
                    <SubmitButton size="sm" pendingText="Enviando…">
                      <Send className="size-3.5" /> {q.status === "SENT" ? "Reenviar" : "Enviar al cliente"}
                    </SubmitButton>
                  </ActionForm>
                )}
                <form action={deleteQuote.bind(null, q.id)}>
                  <ConfirmButton message="¿Eliminar esta cotización?" variant="ghost">
                    <Trash2 className="size-3.5" />
                  </ConfirmButton>
                </form>
              </div>
            </div>

            {editable && (
              <ActionForm action={updateQuote.bind(null, q.id)} className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-3">
                <Field label="Título" className="sm:col-span-2">
                  <Input name="title" defaultValue={q.title} />
                </Field>
                <Field label="Válida hasta">
                  <Input type="date" name="validUntil" defaultValue={toDateInput(q.validUntil)} />
                </Field>
                <div className="sm:col-span-3">
                  <QuoteMessageEditor quoteId={q.id} initial={q.message ?? ""} />
                </div>
                <div>
                  <SubmitButton size="sm" variant="secondary">
                    Guardar
                  </SubmitButton>
                </div>
              </ActionForm>
            )}
            {!editable && q.message && <p className="border-b border-slate-100 p-5 text-sm whitespace-pre-line text-slate-700">{q.message}</p>}

            <div className="grid gap-4 p-5 lg:grid-cols-2">
              {q.options.map((o) => {
                const total = o.items.reduce((s, i) => s + toNumber(i.price), 0);
                const commission = o.items.reduce(
                  (s, i) => s + (toNumber(i.price) * toNumber(i.commissionRate ?? defaultRate)) / 100,
                  0,
                );
                const accepted = q.acceptedOptionId === o.id;
                return (
                  <div key={o.id} className={clsx("rounded-xl border p-4", accepted ? "border-emerald-300 bg-emerald-50" : "border-slate-200")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                          {accepted && <CheckCircle2 className="size-4 text-emerald-600" />}
                          {o.name}
                        </p>
                        {o.description && <p className="text-xs text-slate-500">{o.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{money(total, b.currency)}</p>
                        <p className="text-xs text-emerald-700">Comisión {money(commission, b.currency)}</p>
                      </div>
                    </div>
                    <ul className="mt-3 divide-y divide-slate-100 text-sm">
                      {o.items.map((i) => (
                        <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                          <div>
                            <span className="text-xs text-slate-400">{ITEM_TYPE_LABEL[i.type]}</span>
                            <p className="text-slate-800">{i.description}</p>
                            <p className="text-xs text-slate-500">
                              {[i.supplier, i.startDate && formatRange(i.startDate, i.endDate)].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="whitespace-nowrap">{money(i.price, b.currency)}</span>
                            {editable && (
                              <form action={deleteQuoteItem.bind(null, i.id)}>
                                <button className="text-slate-300 hover:text-rose-600" title="Quitar">
                                  <Trash2 className="size-3.5" />
                                </button>
                              </form>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {editable && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-brand-700">+ Agregar servicio a esta opción</summary>
                        <ActionForm action={addQuoteItem.bind(null, o.id)} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2">
                          <ItemFields defaultRate={defaultRate} withConfirmation={false} />
                          <div className="flex items-end">
                            <SubmitButton size="sm">Agregar</SubmitButton>
                          </div>
                        </ActionForm>
                        {q.options.length > 1 && (
                          <form action={deleteQuoteOption.bind(null, o.id)} className="mt-3">
                            <ConfirmButton message={`¿Eliminar la opción "${o.name}"?`}>Eliminar opción</ConfirmButton>
                          </form>
                        )}
                      </details>
                    )}
                  </div>
                );
              })}
              {editable && (
                <div className="rounded-xl border border-dashed border-slate-300 p-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">Agregar otra opción</p>
                  <ActionForm action={addQuoteOption.bind(null, q.id)} resetOnSuccess className="space-y-2">
                    <Input name="name" placeholder="Ej: Opción Deluxe" required />
                    <Textarea name="description" rows={2} placeholder="Para quién conviene, qué la diferencia…" />
                    <SubmitButton size="sm" variant="secondary">
                      Agregar opción
                    </SubmitButton>
                  </ActionForm>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
