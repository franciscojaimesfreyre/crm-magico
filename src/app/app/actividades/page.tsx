import clsx from "clsx";
import { Pencil, Sparkles, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { buttonClass, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_COLOR, ACTIVITY_TYPE_LABEL } from "@/lib/labels";
import { deleteActivityTemplate, saveActivityTemplate } from "../plantillas/actions";

export const metadata = { title: "Actividades" };

export default async function ActivityTemplatesPage() {
  const user = await requireUser();
  const items = await db.activityTemplate.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ custom: "desc" }, { type: "asc" }, { title: "asc" }] });
  return (
    <>
      <PageHeader
        title="Actividades guardadas"
        description="Aparecen en la paleta del editor de itinerarios para arrastrarlas a cualquier día. Las que creás vos también le sirven de referencia a la IA cuando arma un itinerario: las usa si encajan con el viaje, sin estar obligada."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((a) => (
              <li key={a.id} className="px-4 py-2.5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div className={clsx("min-w-0 flex-1 rounded-md border-l-4 px-3 py-1.5", ACTIVITY_TYPE_COLOR[a.type])}>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                        {a.title}
                        {a.custom ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-px text-xs font-medium text-brand-800" title="La creaste vos: la IA la tiene en cuenta">
                            <Sparkles className="size-3" /> Tuya · la usa la IA
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-px text-[11px] font-medium text-slate-500" title="Viene con la cuenta. Si la editás, pasa a ser tuya.">
                            Precargada
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {[ACTIVITY_TYPE_LABEL[a.type], a.location, a.durationMin && `${a.durationMin} min`].filter(Boolean).join(" · ")}
                      </p>
                      {a.notes && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{a.notes}</p>}
                    </div>
                    <span className={buttonClass("ghost", "sm")} title="Editar">
                      <Pencil className="size-3.5" />
                    </span>
                  </summary>
                  <div className="mt-2 flex flex-wrap items-start gap-2 rounded-lg bg-slate-50 p-3">
                    <ActionForm action={saveActivityTemplate} className="grid grid-cols-1 min-w-0 flex-1 gap-2 sm:grid-cols-2">
                      <input type="hidden" name="id" value={a.id} />
                      <Field label="Título" className="sm:col-span-2">
                        <Input name="title" defaultValue={a.title} required />
                      </Field>
                      <Field label="Tipo">
                        <Select name="type" options={ACTIVITY_TYPES} defaultValue={a.type} />
                      </Field>
                      <Field label="Duración (min)">
                        <Input type="number" name="durationMin" min={5} defaultValue={a.durationMin ?? ""} />
                      </Field>
                      <Field label="Lugar" className="sm:col-span-2">
                        <Input name="location" defaultValue={a.location ?? ""} />
                      </Field>
                      <Field label="Notas / tips" className="sm:col-span-2">
                        <Textarea name="notes" rows={2} defaultValue={a.notes ?? ""} />
                      </Field>
                      <div className="sm:col-span-2">
                        <SubmitButton size="sm">Guardar cambios</SubmitButton>
                      </div>
                    </ActionForm>
                    <form action={deleteActivityTemplate.bind(null, a.id)} className="self-end">
                      <ConfirmButton variant="ghost" message="¿Eliminar esta actividad guardada?">
                        <Trash2 className="size-3.5" /> Eliminar
                      </ConfirmButton>
                    </form>
                  </div>
                </details>
              </li>
            ))}
            {items.length === 0 && <li className="p-5 text-sm text-slate-500">No hay actividades guardadas.</li>}
          </ul>
        </Card>
        <Card className="self-start">
          <CardHeader title="Nueva actividad" />
          <ActionForm action={saveActivityTemplate} resetOnSuccess className="space-y-3 p-4">
            <Field label="Título">
              <Input name="title" placeholder="Ej: Desayuno con personajes en Chef Mickey's" required />
            </Field>
            <Field label="Tipo">
              <Select name="type" options={ACTIVITY_TYPES} defaultValue="RIDE" />
            </Field>
            <Field label="Lugar">
              <Input name="location" />
            </Field>
            <Field label="Duración (min)">
              <Input type="number" name="durationMin" min={5} />
            </Field>
            <Field label="Notas / tips">
              <Textarea name="notes" rows={2} />
            </Field>
            <SubmitButton className="w-full">Guardar</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
