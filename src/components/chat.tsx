"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { Send } from "lucide-react";

export type ChatMessage = {
  id: string;
  body: string;
  senderType: "AGENT" | "CLIENT" | "SYSTEM";
  senderName: string;
  createdAt: string;
  /** Fecha/hora ya formateada en el servidor (evita diferencias de zona horaria al hidratar). */
  timeLabel: string;
};

const POLL_MS = 8000;

/**
 * Chat de un hilo (cliente + reserva). Se actualiza cada pocos segundos.
 * `viewer` define de qué lado se dibujan los mensajes propios.
 */
export function Chat({
  initial,
  viewer,
  send,
  poll,
  placeholder = "Escribí un mensaje…",
  className,
}: {
  initial: ChatMessage[];
  viewer: "AGENT" | "CLIENT";
  send: (body: string) => Promise<ChatMessage[]>;
  poll: () => Promise<ChatMessage[]>;
  placeholder?: string;
  className?: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        setMessages(await poll());
      } catch {
        // Un error de red puntual no debe romper el chat; se reintenta en el próximo ciclo.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function submit() {
    const body = text.trim();
    if (!body) return;
    setText("");
    start(async () => setMessages(await send(body)));
  }

  return (
    <div className={clsx("flex flex-col", className)}>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Todavía no hay mensajes en esta conversación.</p>}
        {messages.map((m) => {
          if (m.senderType === "SYSTEM") {
            return (
              <p key={m.id} className="mx-auto max-w-md rounded-lg bg-slate-100 px-3 py-1.5 text-center text-xs text-slate-500">
                {m.body}
              </p>
            );
          }
          const mine = m.senderType === viewer;
          return (
            <div key={m.id} className={clsx("flex", mine ? "justify-end" : "justify-start")}>
              <div className={clsx("max-w-[75%] rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200")}>
                <p className="whitespace-pre-line">{m.body}</p>
                <p className={clsx("mt-1 text-[11px]", mine ? "text-white/70" : "text-slate-400")}>
                  {m.senderName} · {m.timeLabel}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <div className="flex items-end gap-2 border-t border-slate-200 bg-white p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={placeholder}
          className="field resize-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !text.trim()}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          title="Enviar (Enter)"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}
