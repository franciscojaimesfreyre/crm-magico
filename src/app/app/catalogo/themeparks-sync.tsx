"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { ThemeParksCredit } from "@/components/themeparks";
import { syncThemeParksNow } from "./actions";

const WHEN = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const list = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(", ")} y ${names.length - 3} más` : names.join(", "));

/** Trae ya de ThemeParks.wiki los horarios y los cierres (se sincronizan solos una vez por día). */
export function ThemeParksSync({ lastSync }: { lastSync: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function sync() {
    start(async () => {
      const res = await syncThemeParksNow();
      if ("error" in res) return setMessage({ tone: "error", text: res.error });
      const { hours, catalog } = res;
      setMessage({
        tone: "ok",
        text: [
          hours.parks === 0 ? "Ninguna ficha de parque coincide con los parques de ThemeParks.wiki." : `Horarios: ${hours.days} días en ${hours.parks} ${hours.parks === 1 ? "parque" : "parques"}.`,
          catalog.linked > 0 && `${catalog.linked} lugares vinculados.`,
          catalog.closed.length > 0 && `Cerradas: ${list(catalog.closed)}.`,
          catalog.reopened.length > 0 && `Reabrieron: ${list(catalog.reopened)}.`,
        ]
          .filter(Boolean)
          .join(" "),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-sm flex-col items-end gap-1 text-right">
      <button type="button" onClick={sync} disabled={pending} className={buttonClass("secondary")}>
        <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} /> {pending ? "Actualizando…" : "Actualizar desde ThemeParks.wiki"}
      </button>
      {message ? (
        <p className={message.tone === "ok" ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{message.text}</p>
      ) : (
        <p className="text-xs text-slate-500">{lastSync ? `Última actualización: ${WHEN.format(new Date(lastSync))}` : "Todavía no se actualizó"}</p>
      )}
      <ThemeParksCredit />
    </div>
  );
}
