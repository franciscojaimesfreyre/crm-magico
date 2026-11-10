import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isPersonalForm, type FormField } from "@/lib/forms";
import { FormRenderer } from "@/components/form-renderer";
import { FormShell } from "@/components/form-shell";
import { submitForm } from "./actions";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const form = await db.form.findUnique({ where: { slug }, include: { organization: { select: { name: true } } } });
  return { title: form ? `${form.title} · ${form.organization.name}` : "Formulario", robots: { index: false } };
}

export default async function PublicForm({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await db.form.findUnique({ where: { slug }, include: { organization: true } });
  if (!form) notFound();
  return (
    <FormShell org={form.organization} title={form.title} description={form.description}>
      {!form.active ? (
        <p className="text-[15px] text-slate-600">Este formulario ya no recibe respuestas.</p>
      ) : isPersonalForm(form.fields as FormField[]) ? (
        <p className="text-[15px] text-slate-600">Este formulario se completa con el link personal que te mandó tu agente. Si no lo tenés, pedíselo.</p>
      ) : (
        <FormRenderer fields={form.fields as FormField[]} action={submitForm.bind(null, slug)} />
      )}
    </FormShell>
  );
}
