import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form-controls";
import { Card, CardHeader, Field, Input, PageHeader, Select } from "@/components/ui";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_COLOR, ACTIVITY_TYPE_LABEL } from "@/lib/labels";
import { deleteActivityTemplate, saveActivityTemplate } from "../plantillas/actions";

export const metadata = { title: "Actividades" };

export default async function ActivityTemplatesPage() {
  const user = await requireUser();
  const items = await db.activityTemplate.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ type: "asc" }, { title: "asc" }] });
  return (
    <>
      <PageHeader title="Actividades guardadas" description="Aparecen en la paleta del editor de itinerarios para arrastrarlas a cualquier día." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className={clsx("flex-1 rounded-md border-l-4 px-3 py-1.5", ACTIVITY_TYPE_COLOR[a.type])}>
                  <p className="text-sm font-medium text-slate-900">{a.title}</p>
                  <p className="text-xs text-slate-500">
                    {[ACTIVITY_TYPE_LABEL[a.type], a.location, a.durationMin && `${a.durationMin} min`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <form action={deleteActivityTemplate.bind(null, a.id)}>
                  <ConfirmButton variant="ghost" message="¿Eliminar esta actividad guardada?">
                    <Trash2 className="size-3.5" />
                  </ConfirmButton>
                </form>
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
              <Input name="notes" />
            </Field>
            <SubmitButton className="w-full">Guardar</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
