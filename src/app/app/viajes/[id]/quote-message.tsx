"use client";

import { useState, useTransition } from "react";
import { Wand2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { generateQuoteMessage } from "../quote-actions";

export function QuoteMessageEditor({ quoteId, initial, single = true }: { quoteId: string; initial: string; single?: boolean }) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="label mb-0">Mensaje para el cliente</span>
        <button
          type="button"
          disabled={pending}
          className={buttonClass("magic", "sm")}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await generateQuoteMessage(quoteId);
              if (res.error) setError(res.error);
              else if (res.message) setText(res.message);
            })
          }
        >
          <Wand2 className="size-3.5" /> {pending ? "Redactando…" : "Redactar con IA"}
        </button>
      </div>
      <textarea name="message" rows={5} className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder={single ? "Contale al cliente qué incluye la cotización…" : "Contale al cliente qué incluye cada opción y en qué se diferencian…"} />
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
      <p className="mt-1 text-xs text-slate-500">La IA usa los servicios cargados, el perfil de la familia y las novedades vigentes.</p>
    </div>
  );
}
