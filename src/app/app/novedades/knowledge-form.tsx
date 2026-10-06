import { ActionForm, SubmitButton, type ActionState } from "@/components/form-controls";
import { Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { DESTINATIONS, KNOWLEDGE_CATEGORIES } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import type { KnowledgeItem } from "@/generated/prisma/client";

export function KnowledgeForm({
  action,
  item,
  canGlobal,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  item?: KnowledgeItem;
  canGlobal: boolean;
}) {
  return (
    <ActionForm action={action}>
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Título *" className="sm:col-span-2">
          <Input name="title" defaultValue={item?.title} required placeholder="Ej: Remodelación de Space Mountain hasta marzo" />
        </Field>
        <Field label="Contenido *" hint="Escribilo como se lo contarías a otro agente. La IA lo usa tal cual." className="sm:col-span-2">
          <Textarea name="content" rows={8} defaultValue={item?.content} required />
        </Field>
        <Field label="Categoría">
          <Select name="category" options={KNOWLEDGE_CATEGORIES} defaultValue={item?.category ?? "NEWS"} />
        </Field>
        <Field label="Parque / lugar">
          <Input name="park" defaultValue={item?.park ?? ""} placeholder="Ej: Magic Kingdom" />
        </Field>
        <div className="sm:col-span-2">
          <span className="label">Destinos (ninguno = aplica a todos)</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DESTINATIONS.map((d) => (
              <Checkbox key={d.value} name="destinations" value={d.value} label={d.label} defaultChecked={item?.destinations.includes(d.value)} />
            ))}
          </div>
        </div>
        <Field label="Vigente desde">
          <Input type="date" name="validFrom" defaultValue={toDateInput(item?.validFrom)} />
        </Field>
        <Field label="Vigente hasta" hint="Vencida, la IA deja de usarla">
          <Input type="date" name="validTo" defaultValue={toDateInput(item?.validTo)} />
        </Field>
        <Field label="Etiquetas" hint="Separadas por coma">
          <Input name="tags" defaultValue={item?.tags.join(", ")} />
        </Field>
        <Field label="Fuente (link)">
          <Input name="sourceUrl" type="url" defaultValue={item?.sourceUrl ?? ""} placeholder="https://" />
        </Field>
        <div className="flex flex-wrap gap-5 sm:col-span-2">
          <Checkbox name="published" label="Publicada (la IA la usa)" defaultChecked={item?.published ?? true} />
          <Checkbox name="pinned" label="Destacada" defaultChecked={item?.pinned} />
          {canGlobal && !item && (
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="scope" value="global" className="size-4 rounded border-slate-300" />
              Global (para todas las agencias de la plataforma)
            </label>
          )}
        </div>
        <div className="sm:col-span-2">
          <SubmitButton>Guardar</SubmitButton>
        </div>
      </Card>
    </ActionForm>
  );
}
