"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { SelectField } from "@/components/select-field";
import { TASK_PRIORITIES } from "@/lib/labels";
import type { WorkflowAction } from "@/lib/automations";

type Option = { value: string; label: string };

/** Una acción de la automatización: al elegir qué hace, muestra solo los campos de esa acción. */
export function ActionRow({ index: i, initial, types, templates, forms }: { index: number; initial?: WorkflowAction; types: Option[]; templates: Option[]; forms: Option[] }) {
  const [type, setType] = useState<string>(initial?.type ?? "");
  const a = initial;
  return (
    <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-4">
      <Field label={`Acción ${i + 1}`}>
        <SelectField name={`a${i}_type`} options={types} value={type} onValueChange={setType} placeholder="—" />
      </Field>
      {(type === "CREATE_TASK" || type === "NOTIFY") && (
        <Field label={type === "NOTIFY" ? "Título de la notificación" : "Título de la tarea"} className="sm:col-span-3">
          <Input name={`a${i}_title`} defaultValue={a && "title" in a ? a.title : ""} placeholder="Ej: Reservar restaurantes para {{clientFullName}}" />
        </Field>
      )}
      {type === "CREATE_TASK" && (
        <>
          <Field label="Prioridad">
            <Select name={`a${i}_priority`} options={TASK_PRIORITIES} defaultValue={a?.type === "CREATE_TASK" ? (a.priority ?? "MEDIUM") : "MEDIUM"} />
          </Field>
          <Field label="Vence en días">
            <Input type="number" name={`a${i}_due`} min={0} defaultValue={a?.type === "CREATE_TASK" ? (a.dueInDays ?? 0) : 0} />
          </Field>
        </>
      )}
      {type === "SEND_EMAIL" && (
        <Field label="Plantilla de email" className="sm:col-span-3">
          <Select name={`a${i}_template`} options={templates} defaultValue={a?.type === "SEND_EMAIL" ? a.templateId : ""} placeholder="—" />
        </Field>
      )}
      {type === "SEND_MESSAGE" && (
        <Field label="Mensaje (portal)" className="sm:col-span-3">
          <Input name={`a${i}_body`} defaultValue={a?.type === "SEND_MESSAGE" ? a.body : ""} />
        </Field>
      )}
      {type === "SEND_FORM" && (
        <Field label="Formulario" hint="Le llega con un link personal (portal y email), y si no responde en 5 días se le recuerda." className="sm:col-span-3">
          <Select name={`a${i}_form`} options={forms} defaultValue={a?.type === "SEND_FORM" ? a.formId : ""} placeholder="—" />
        </Field>
      )}
    </div>
  );
}
