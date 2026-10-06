import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import type { FormField } from "@/lib/forms";
import { submitForm } from "./actions";

export const metadata = { robots: { index: false } };

export default async function PublicForm({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await db.form.findUnique({ where: { slug }, include: { organization: true } });
  if (!form) notFound();
  const fields = form.fields as FormField[];
  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-white to-sky-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <p className="mb-2 text-center text-sm text-slate-500">{form.organization.name}</p>
        <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-100">
          <h1 className="text-xl font-semibold text-slate-900">{form.title}</h1>
          {form.description && <p className="mt-1 mb-5 text-sm text-slate-500">{form.description}</p>}
          {!form.active ? (
            <p className="text-sm text-slate-500">Este formulario ya no recibe respuestas.</p>
          ) : (
            <ActionForm action={submitForm.bind(null, slug)} resetOnSuccess className="space-y-4">
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
              {fields.map((f) =>
                f.type === "checkbox" ? (
                  <label key={f.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name={f.id} className="size-4 rounded border-slate-300" /> {f.label}
                  </label>
                ) : (
                  <label key={f.id} className="block">
                    <span className="label">
                      {f.label} {f.required && "*"}
                    </span>
                    {f.type === "textarea" ? (
                      <textarea name={f.id} rows={3} required={f.required} className="field" />
                    ) : f.type === "select" ? (
                      <select name={f.id} required={f.required} className="field" defaultValue="">
                        <option value="">Elegí una opción</option>
                        {(f.options ?? []).map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input name={f.id} required={f.required} type={f.type === "phone" ? "tel" : f.type} className="field" />
                    )}
                  </label>
                ),
              )}
              <SubmitButton className="w-full py-3" pendingText="Enviando…">
                Enviar
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>
    </div>
  );
}
