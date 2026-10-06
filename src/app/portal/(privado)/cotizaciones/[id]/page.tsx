import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireClientAccount } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Alert } from "@/components/ui";
import { DESTINATION_LABEL, ITEM_TYPE_LABEL } from "@/lib/labels";
import { formatDate, formatRange, money, toNumber } from "@/lib/format";
import { acceptQuote, rejectQuote } from "../../../actions";

export const metadata = { title: "Cotización" };

export default async function PortalQuote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireClientAccount();
  const quote = await db.quote.findFirst({
    where: { id, booking: { clientId: account.clientId }, status: { in: ["SENT", "ACCEPTED", "REJECTED", "EXPIRED"] } },
    include: {
      booking: { include: { agent: true } },
      options: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" } } } },
    },
  });
  if (!quote) notFound();
  const b = quote.booking;
  const open = quote.status === "SENT";
  const expired = quote.validUntil && quote.validUntil < new Date() && open;

  return (
    <div className="space-y-5">
      <Link href={`/portal/viajes/${b.id}`} className="text-sm text-slate-500 hover:text-slate-800">
        ← {b.title}
      </Link>
      <header>
        <p className="text-xs font-semibold tracking-widest text-amber-600 uppercase">Cotización</p>
        <h1 className="text-2xl font-semibold text-slate-900">{quote.title}</h1>
        <p className="text-sm text-slate-500">
          {DESTINATION_LABEL[b.destination]} · {formatRange(b.startDate, b.endDate)}
          {quote.validUntil && ` · Válida hasta el ${formatDate(quote.validUntil)}`}
        </p>
      </header>

      {quote.message && (
        <div className="rounded-2xl bg-white p-4 text-sm whitespace-pre-line text-slate-700 shadow-sm ring-1 ring-slate-100">
          {quote.message}
          {b.agent && <p className="mt-3 font-medium text-slate-900">{b.agent.name}</p>}
        </div>
      )}

      {quote.status === "ACCEPTED" && <Alert tone="success">¡Aceptaste esta cotización! Tu agente está confirmando las reservas con cada proveedor.</Alert>}
      {quote.status === "REJECTED" && <Alert tone="info">Respondiste que esta cotización no te convence. Tu agente ya fue avisado.</Alert>}
      {quote.status === "EXPIRED" && <Alert tone="info">Esta cotización ya no está vigente.</Alert>}
      {expired && <Alert tone="warn">La fecha de validez ya pasó: los precios pueden haber cambiado. Consultá con tu agente antes de aceptar.</Alert>}

      <ActionForm action={acceptQuote.bind(null, quote.id)} className="space-y-4">
        {quote.options.map((o) => {
          const total = o.items.reduce((s, i) => s + toNumber(i.price), 0);
          const accepted = quote.acceptedOptionId === o.id;
          return (
            <label
              key={o.id}
              className={clsx(
                "block rounded-2xl bg-white p-4 shadow-sm ring-1 transition",
                accepted ? "ring-2 ring-emerald-400" : "ring-slate-100",
                open && "cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-brand-500",
              )}
            >
              <div className="flex items-start gap-3">
                {open && <input type="radio" name="optionId" value={o.id} defaultChecked={quote.options.length === 1} className="mt-1 size-4 text-brand-600" />}
                {accepted && <CheckCircle2 className="mt-0.5 size-5 text-emerald-500" />}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">{o.name}</p>
                    <p className="text-lg font-semibold text-brand-700">{money(total, b.currency)}</p>
                  </div>
                  {o.description && <p className="text-sm text-slate-500">{o.description}</p>}
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {o.items.map((i) => (
                      <li key={i.id} className="flex justify-between gap-3">
                        <span className="text-slate-700">
                          <span className="text-xs text-slate-400">{ITEM_TYPE_LABEL[i.type]} · </span>
                          {i.description}
                          {i.startDate && <span className="text-xs text-slate-400"> ({formatRange(i.startDate, i.endDate)})</span>}
                        </span>
                        <span className="whitespace-nowrap text-slate-600">{money(i.price, b.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </label>
          );
        })}
        {open && (
          <>
            <textarea name="comment" rows={2} className="field" placeholder="¿Algún comentario para tu agente? (opcional)" />
            <SubmitButton className="w-full py-3 text-base" pendingText="Enviando…">
              Aceptar la opción elegida
            </SubmitButton>
          </>
        )}
      </ActionForm>

      {open && (
        <details className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <summary className="cursor-pointer text-sm text-slate-600">No me convence ninguna opción</summary>
          <ActionForm action={rejectQuote.bind(null, quote.id)} className="mt-3 space-y-3">
            <textarea name="comment" rows={3} className="field" placeholder="Contale a tu agente qué te gustaría cambiar" />
            <SubmitButton variant="secondary" pendingText="Enviando…">
              Avisar a mi agente
            </SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
