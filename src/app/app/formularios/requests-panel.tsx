import Link from "next/link";
import { AlertTriangle, Send, X } from "lucide-react";
import { ConfirmButton } from "@/components/form-controls";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, Checkbox, GroupedSelect } from "@/components/ui";
import { CopyText } from "@/app/app/clientes/[id]/client-widgets";
import { formatDate } from "@/lib/format";
import { formRequestUrl, gapsSignature, travelerGaps } from "@/lib/form-answers";
import { FORM_TEMPLATES, isPersonalForm, type FormField } from "@/lib/forms";
import { cancelFormRequest, dismissTravelerGaps, requestTravelerData, sendFormRequest } from "./actions";

const STATUS: Record<string, { label: string; className: string }> = {
  SENT: { label: "Enviado", className: "bg-slate-100 text-slate-700" },
  OPENED: { label: "Abierto", className: "bg-sky-50 text-sky-800" },
  ANSWERED: { label: "Respondido", className: "bg-emerald-50 text-emerald-800" },
};

/**
 * Formularios pedidos a un cliente (en su ficha) o para un viaje (en el viaje): enviar uno nuevo con link
 * personal y ver en qué quedó cada uno. En el viaje, además, qué datos de los viajeros faltan.
 */
export async function FormRequestsPanel({ organizationId, clientId, bookingId }: { organizationId: string; clientId: string; bookingId?: string }) {
  const [forms, requests, client, dismissed] = await Promise.all([
    db.form.findMany({ where: { organizationId, active: true }, orderBy: { title: "asc" }, select: { id: true, title: true, fields: true } }),
    db.formRequest.findMany({
      where: bookingId ? { bookingId } : { clientId },
      orderBy: { sentAt: "desc" },
      include: { form: { select: { id: true, title: true } }, booking: { select: { id: true, code: true } }, submission: { select: { id: true, appliedAt: true } } },
    }),
    db.client.findUniqueOrThrow({ where: { id: clientId }, select: { email: true } }),
    bookingId ? db.booking.findUnique({ where: { id: bookingId }, select: { travelerGapsDismissed: true } }).then((b) => !!b?.travelerGapsDismissed) : Promise.resolve(false),
  ]);
  // Qué se puede enviar: primero los formularios personales (y las plantillas personales que todavía no se
  // crearon, que se crean al enviarlas); los públicos, aparte. Los títulos repetidos se numeran.
  const personal = forms.filter((f) => isPersonalForm(f.fields as FormField[]));
  const others = forms.filter((f) => !isPersonalForm(f.fields as FormField[]));
  const missingTemplates = FORM_TEMPLATES.filter((t) => t.personal && !personal.some((f) => f.title === t.title || (t.key === "travelers" && (f.fields as FormField[]).some((x) => x.type === "travelers"))));
  const label = (list: typeof forms) => list.map((f, i) => ({ value: f.id, label: list.slice(0, i).some((x) => x.title === f.title) ? `${f.title} (${list.slice(0, i + 1).filter((x) => x.title === f.title).length})` : f.title }));
  const groups = [
    { label: "Para pedirle datos", options: [...label(personal), ...missingTemplates.map((t) => ({ value: `tpl:${t.key}`, label: t.title }))] },
    ...(others.length ? [{ label: "Otros (piden nombre y email)", options: label(others) }] : []),
  ];

  return (
    <Card>
      <CardHeader
        title="Formularios"
        description="Pedile datos al cliente con un link personal: la respuesta llega asociada y la revisás antes de pasarla a la ficha."
        actions={
          dismissed && bookingId ? (
            <form action={dismissTravelerGaps.bind(null, bookingId, null)}>
              <button className="text-xs font-medium text-brand-700 hover:underline">Volver a mostrar el aviso de datos de viajeros</button>
            </form>
          ) : undefined
        }
      />
      {requests.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {requests.map((r) => {
            const s = STATUS[r.status];
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium text-slate-900">
                    {r.form.title}
                    {!bookingId && r.booking && (
                      <Link href={`/app/viajes/${r.booking.id}`} className="ml-2 text-xs font-normal text-brand-700 hover:underline">
                        {r.booking.code}
                      </Link>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    Enviado el {formatDate(r.sentAt)}
                    {r.openedAt && r.status === "OPENED" && ` · abierto el ${formatDate(r.openedAt)}`}
                    {r.answeredAt && ` · respondido el ${formatDate(r.answeredAt)}`}
                    {r.remindedAt && r.status !== "ANSWERED" && ` · se le recordó el ${formatDate(r.remindedAt)}`}
                  </p>
                </div>
                <Badge className={s.className}>{s.label}</Badge>
                {r.status === "ANSWERED" && r.submission ? (
                  <Link href={`/app/formularios/${r.form.id}?tab=respuestas#r-${r.submission.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                    {r.submission.appliedAt ? "Ver respuesta" : "Revisar y pasar a la ficha"}
                  </Link>
                ) : (
                  <>
                    <CopyText text={formRequestUrl(r.token)} label="Copiar link" />
                    <form action={cancelFormRequest.bind(null, r.id)}>
                      <button className="grid size-7 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Cancelar el pedido" aria-label="Cancelar el pedido">
                        <X className="size-3.5" />
                      </button>
                    </form>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(
        <ActionForm action={sendFormRequest} className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-5 py-4">
          <input type="hidden" name="clientId" value={clientId} />
          {bookingId && <input type="hidden" name="bookingId" value={bookingId} />}
          <label className="min-w-56 flex-1">
            <span className="label">Enviar formulario</span>
            <GroupedSelect name="formId" groups={groups} placeholder="Elegí cuál" />
          </label>
          <Checkbox name="email" label={client.email ? `También por email (${client.email})` : "Sin email: vas a copiar el link"} defaultChecked={!!client.email} disabled={!client.email} />
          <SubmitButton size="sm">
            <Send className="size-3.5" /> Enviar
          </SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}

/**
 * Arriba del Resumen del viaje: qué datos les faltan a los viajeros y el botón para pedirlos. Si está todo,
 * no se muestra.
 */
export async function TravelerDataStrip({ bookingId }: { bookingId: string }) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { startDate: true, destination: true, status: true, travelerGapsDismissed: true, client: { select: { email: true } }, travelers: { include: { traveler: true } } },
  });
  if (!booking || booking.travelers.length === 0 || booking.status === "CANCELLED") return null;
  const gaps = travelerGaps(
    booking.travelers.map((t) => t.traveler),
    booking.startDate,
    booking.destination !== "OTHER",
  );
  const incomplete = gaps.filter((g) => g.missing.length > 0);
  if (incomplete.length === 0) return null;
  // Descartado para estos mismos faltantes: no se muestra (si cambian, vuelve).
  const signature = gapsSignature(incomplete);
  if (booking.travelerGapsDismissed === signature) return null;
  const open = await db.formRequest.findMany({ where: { bookingId, status: { not: "ANSWERED" } }, include: { form: { select: { fields: true } } }, orderBy: { sentAt: "desc" } });
  const pending = open.find((r) => (r.form.fields as FormField[]).some((f) => f.type === "travelers"));
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-amber-50 px-5 py-4 ring-1 ring-amber-200">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <AlertTriangle className="size-4 text-amber-600" />
          Datos de los viajeros: {gaps.length - incomplete.length} de {gaps.length} completos
        </p>
        <ul className="mt-1 space-y-0.5 text-[13px] text-slate-700">
          {incomplete.map((g) => (
            <li key={g.name}>
              <span className="font-medium">{g.name}</span>: falta {g.missing.join(", ")}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-2">
      {pending ? (
        <span className="text-[13px] text-slate-600">Ya se los pediste el {formatDate(pending.sentAt)}: esperando respuesta.</span>
      ) : (
        <form action={requestTravelerData.bind(null, bookingId)}>
          <ConfirmButton
            variant="primary"
            message={booking.client.email ? `Se le envía el formulario "Datos de los viajeros" a ${booking.client.email} y a su portal. ¿Enviar?` : `El cliente no tiene email: le aparece en su portal y vas a poder copiar el link para WhatsApp. ¿Enviar?`}
          >
            <Send className="size-3.5" /> Pedir lo que falta
          </ConfirmButton>
        </form>
      )}
        <form action={dismissTravelerGaps.bind(null, bookingId, signature)}>
          <button className="grid size-8 place-items-center rounded-full text-slate-500 hover:bg-amber-100 hover:text-slate-800" title="Descartar el aviso (no hacen falta estos datos)" aria-label="Descartar el aviso">
            <X className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
