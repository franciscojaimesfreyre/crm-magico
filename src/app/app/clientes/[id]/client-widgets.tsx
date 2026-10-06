"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Copy } from "lucide-react";
import { revealSupplierPassword } from "../actions";

export function RevealPassword({ loginId }: { loginId: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{value ?? "••••••••"}</code>
      <button
        type="button"
        className="text-slate-400 hover:text-slate-700"
        title={value ? "Ocultar" : "Mostrar (queda registrado)"}
        disabled={pending}
        onClick={() => {
          if (value) return setValue(null);
          start(async () => setValue(await revealSupplierPassword(loginId)));
        }}
      >
        {value ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      {value && (
        <button type="button" className="text-slate-400 hover:text-slate-700" title="Copiar" onClick={() => navigator.clipboard.writeText(value)}>
          <Copy className="size-4" />
        </button>
      )}
    </span>
  );
}

export function CopyText({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
    >
      <Copy className="size-3.5" />
      {copied ? "¡Copiado!" : (label ?? "Copiar")}
    </button>
  );
}

type Template = { id: string; name: string; subject: string; body: string };

/** Selector de plantilla que completa asunto y cuerpo (los campos siguen editables). */
export function TemplatePicker({ templates }: { templates: Template[] }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Plantilla</span>
        <select
          className="field"
          defaultValue=""
          onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (t) {
              setSubject(t.subject);
              setBody(t.body);
            }
          }}
        >
          <option value="">Escribir desde cero</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Asunto</span>
        <input name="subject" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </label>
      <label className="block">
        <span className="label">Mensaje</span>
        <textarea name="body" className="field font-mono text-xs" rows={10} value={body} onChange={(e) => setBody(e.target.value)} required />
      </label>
      <p className="text-xs text-slate-400">Las variables como {"{{clientName}}"} o {"{{tripDates}}"} se completan solas al enviar.</p>
    </div>
  );
}
