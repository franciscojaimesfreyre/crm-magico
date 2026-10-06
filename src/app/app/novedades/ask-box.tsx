"use client";

import { useActionState } from "react";
import { Wand2 } from "lucide-react";
import { SubmitButton } from "@/components/form-controls";
import { askKnowledgeAction } from "./actions";

type State = Awaited<ReturnType<typeof askKnowledgeAction>> | undefined;

export function AskBox() {
  const [state, action] = useActionState<State, FormData>(askKnowledgeAction, undefined);
  return (
    <div className="rounded-xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-brand-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <Wand2 className="size-4 text-fuchsia-600" /> Preguntale a la IA
      </p>
      <p className="mb-3 text-xs text-slate-600">Responde usando primero estas novedades. Ej: “¿Qué tener en cuenta para Disney World en diciembre?”</p>
      <form action={action} className="flex gap-2">
        <input name="question" className="field" placeholder="Tu pregunta…" defaultValue={state && "question" in state ? state.question : ""} />
        <SubmitButton variant="magic" pendingText="Pensando…">
          Preguntar
        </SubmitButton>
      </form>
      {state && "error" in state && state.error && <p className="mt-2 text-sm text-rose-700">{state.error}</p>}
      {state && "answer" in state && (
        <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">
          <p className="whitespace-pre-line">{state.answer}</p>
          {state.sources.length > 0 && <p className="mt-2 text-xs text-slate-400">Fuentes: {state.sources.map((s) => s.title).join(" · ")}</p>}
        </div>
      )}
    </div>
  );
}
