import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, CheckCircle2, ExternalLink, Trash2, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Badge, Card, CardHeader, PageHeader, Select, Tabs } from "@/components/ui";
import { CopyText } from "@/app/app/clientes/[id]/client-widgets";
import { formatDate, formatDateTime } from "@/lib/format";
import { answerText, isPersonalForm, type Answers, type FormField, type TravelerAnswer } from "@/lib/forms";
import { respondentName, travelerChanges } from "@/lib/form-answers";
import { FormEditor } from "../form-editor";
import { applyAnswers, deleteForm, linkSubmission } from "../actions";
import { appUrl } from "@/lib/app-url";

export default async function FormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "editar" } = await searchParams;
  const user = await requireUser();
  const form = await db.form.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { submissions: { orderBy: { createdAt: "desc" }, take: 200, include: { booking: { select: { id: true, code: true, title: true } } } } },
  });
  if (!form) notFound();
  const fields = form.fields as FormField[];
  const url = `${appUrl()}/f/${form.slug}`;
  const personal = isPersonalForm(fields);
  const pending = form.submissions.filter((s) => !s.appliedAt).length;

  // Clientes de las respuestas (con sus viajeros, para mostrar qué cambiaría) y la lista para asociar las anónimas.
  const clientIds = [...new Set(form.submissions.map((s) => s.clientId).filter((x): x is string => !!x))];
  const [clients, allClients] = await Promise.all([
    db.client.findMany({ where: { id: { in: clientIds } }, include: { travelers: true } }),
    tab === "respuestas" && form.submissions.some((s) => !s.clientId)
      ? db.client.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 500, select: { id: true, firstName: true, lastName: true, email: true } })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/app/formularios", label: "Formularios" }}
        title={form.title}
        description={
          personal ? (
            <span className="text-sm">Formulario personal: se envía desde la ficha del cliente o desde el viaje, con un link para cada uno.</span>
          ) : (
          <span className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-500">Link público (para cualquiera):</span>
            <code className="text-xs">{url}</code>
            <CopyText text={url} label="Copiar link" />
            <a href={url} target="_blank" className="text-xs text-brand-700 hover:underline">
              Abrir <ExternalLink className="inline size-3" />
            </a>
          </span>
          )
        }
        actions={
          <form action={deleteForm.bind(null, id)}>
            <ConfirmButton message="¿Eliminar el formulario y sus respuestas?">
              <Trash2 className="size-3.5" /> Eliminar
            </ConfirmButton>
          </form>
        }
      />
      {!personal && (
        <p className="mb-4 text-sm text-[var(--ink-soft)]">
          Para pedírselo a un cliente puntual, usá «Enviar formulario» en su ficha o en el viaje: la respuesta llega asociada.
        </p>
      )}
      <Tabs
        active={tab}
        tabs={[
          { key: "editar", label: "Editar", href: `/app/formularios/${id}` },
          { key: "respuestas", label: pending ? `Respuestas · ${pending} sin revisar` : "Respuestas", href: `/app/formularios/${id}?tab=respuestas`, count: form.submissions.length },
        ]}
      />
      {tab === "editar" ? (
        <FormEditor id={id} initial={{ title: form.title, description: form.description ?? "", active: form.active, fields }} />
      ) : (
        <div className="space-y-4">
          {form.submissions.length === 0 && <p className="text-sm text-slate-500">Todavía no hay respuestas.</p>}
          {form.submissions.map((s) => {
            const data = (s.data ?? {}) as Answers;
            const client = clients.find((c) => c.id === s.clientId);
            const who = client ? `${client.firstName} ${client.lastName}` : respondentName(fields, data) || "Sin nombre";
            // Respuestas a preguntas que después se borraron del formulario: también se muestran.
            const orphan = Object.keys(data).filter((k) => !fields.some((f) => f.id === k));
            const travelerFields = fields.filter((f) => f.type === "travelers");
            const changes = client ? travelerFields.flatMap((f) => travelerChanges((Array.isArray(data[f.id]) ? data[f.id] : []) as TravelerAnswer[], client.travelers, f.id)) : [];
            const emailMatch = !client && allClients.find((c) => {
              const emailField = fields.find((f) => f.mapTo === "email");
              const v = emailField ? data[emailField.id] : undefined;
              return typeof v === "string" && c.email && c.email.toLowerCase() === v.toLowerCase();
            });
            return (
              <Card key={s.id} id={`r-${s.id}`} className={clsx("scroll-mt-6", !s.appliedAt && "ring-1 ring-amber-200")}>
                <CardHeader
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {client ? (
                        <Link href={`/app/clientes/${client.id}`} className="hover:underline">
                          {who}
                        </Link>
                      ) : (
                        who
                      )}
                      {s.booking && (
                        <Link href={`/app/viajes/${s.booking.id}`} className="text-sm font-normal text-brand-700 hover:underline">
                          {s.booking.code} · {s.booking.title}
                        </Link>
                      )}
                    </span>
                  }
                  description={`${formatDateTime(s.createdAt)} · ${s.requestId ? "pedido personal" : "link público"}`}
                  actions={
                    s.appliedAt ? (
                      <Badge className="bg-emerald-50 text-emerald-800">
                        <CheckCircle2 className="mr-1 inline size-3.5" />
                        Pasada a la ficha el {formatDate(s.appliedAt)}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-900">Sin revisar</Badge>
                    )
                  }
                />
                {!s.clientId && (
                  <ActionForm action={linkSubmission.bind(null, s.id)} className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-5 py-4">
                    <label className="min-w-64 flex-1">
                      <span className="label">¿De qué cliente es?</span>
                      <Select
                        name="clientId"
                        defaultValue={emailMatch ? emailMatch.id : "new"}
                        options={[
                          { value: "new", label: "Crear un cliente nuevo con estos datos" },
                          ...allClients.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}${c.email ? ` · ${c.email}` : ""}` })),
                        ]}
                      />
                    </label>
                    <SubmitButton size="sm" variant="secondary">
                      <UserPlus className="size-3.5" /> Asociar
                    </SubmitButton>
                  </ActionForm>
                )}
                {client && !s.appliedAt && (
                  <form action={applyAnswers.bind(null, s.id)} className="border-b border-slate-100 bg-amber-50/40 px-5 py-4">
                    <input type="hidden" name="review" value="1" />
                    <p className="mb-2 text-sm font-medium text-slate-800">Qué cambia si la pasás a la ficha</p>
                    {changes.length > 0 && (
                      <ul className="mb-3 space-y-2 text-sm">
                        {changes.map((c) => (
                          <li key={c.key}>
                            {c.isNew ? (
                              <label className="flex items-center gap-2">
                                <input type="checkbox" name="apply" value={`${c.key}:new`} defaultChecked className="size-4 rounded border-slate-300" />
                                <span className="font-medium text-slate-900">{c.name}</span>
                                <span className="text-emerald-700">· viajero nuevo{s.booking ? ", se suma al viaje" : ""}</span>
                              </label>
                            ) : c.changes.length === 0 ? (
                              <p>
                                <span className="font-medium text-slate-900">{c.name}</span> <span className="text-slate-500">· sin cambios</span>
                              </p>
                            ) : (
                              <>
                                <p className="font-medium text-slate-900">{c.name}</p>
                                <ul className="mt-1 space-y-1 pl-1">
                                  {c.changes.map((x) => (
                                    <li key={x.key}>
                                      <label className="flex flex-wrap items-center gap-x-2">
                                        <input type="checkbox" name="apply" value={x.key} defaultChecked className="size-4 rounded border-slate-300" />
                                        <span className="text-slate-600">{x.label}:</span>
                                        <span className="text-slate-400 line-through">{x.from}</span>
                                        <ArrowRight className="size-3 text-slate-400" />
                                        <span className="font-medium text-slate-900">{x.to}</span>
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mb-3 text-[13px] text-slate-600">
                      En los viajeros se aplican los cambios que dejes marcados (las alergias y la accesibilidad se suman a lo que había). De la ficha del cliente solo se
                      completa lo que estaba vacío.{" "}
                      {s.booking ? "El resto de las respuestas va a las notas del viaje, que usa la IA para el itinerario." : "El resto queda en la actividad del cliente."}
                    </p>
                    <SubmitButton size="sm">Pasar a la ficha</SubmitButton>
                  </form>
                )}
                <dl className="grid grid-cols-1 gap-3 p-5 text-sm sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.id} className={f.type === "travelers" ? "sm:col-span-2" : undefined}>
                      <dt className="text-xs text-slate-500">{f.label}</dt>
                      {f.type === "travelers" && Array.isArray(data[f.id]) ? (
                        <dd>
                          <ul className="mt-1 space-y-1">
                            {(data[f.id] as TravelerAnswer[]).map((t, i) => (
                              <li key={i} className="text-slate-800">
                                <span className="font-medium">{[t.firstName, t.lastName].filter(Boolean).join(" ")}</span>
                                <span className="text-slate-600">
                                  {[
                                    t.birthDate && `nació el ${formatDate(new Date(`${t.birthDate}T00:00:00Z`))}`,
                                    t.heightCm && `${t.heightCm} cm`,
                                    t.passportExpiry && `pasaporte vence ${formatDate(new Date(`${t.passportExpiry}T00:00:00Z`))}`,
                                    t.dietaryNotes,
                                    t.accessibilityNotes,
                                  ]
                                    .filter(Boolean)
                                    .map((x) => ` · ${x}`)
                                    .join("")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      ) : (
                        <dd className="whitespace-pre-line text-slate-800">{answerText(data[f.id])}</dd>
                      )}
                    </div>
                  ))}
                  {orphan.map((k) => (
                    <div key={k}>
                      <dt className="text-xs text-slate-500">Pregunta que ya no está en el formulario</dt>
                      <dd className="whitespace-pre-line text-slate-800">{answerText(data[k])}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
