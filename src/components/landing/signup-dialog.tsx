"use client";

import { useState } from "react";
import clsx from "clsx";

/**
 * El primer paso del alta, ya abierto: el nombre del negocio y si es un agente o una agencia. El botón lleva
 * lo escrito al formulario de registro (/registro?negocio=…&tipo=agencia). Sin script es un formulario GET.
 */
export function SignupDialog() {
  const [business, setBusiness] = useState("Viajes Encantados");
  const [kind, setKind] = useState<"agente" | "agencia">("agente");
  return (
    <form
      action="/registro"
      method="get"
      data-ui
      className="w-full max-w-[440px] rounded-2xl bg-white p-6 text-[15px] text-slate-900 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.5)]" // taste-skill-ignore: es un diálogo abierto
    >
      <p className="text-[20px] font-bold">Creá tu cuenta</p>
      <p className="mt-1 text-[14px] text-slate-600">Gratis. Después cargás tu primer viaje.</p>
      <label className="mt-5 block">
        <span className="mb-1.5 block text-[14px] font-medium text-slate-800">Nombre de tu negocio</span>
        <input name="negocio" value={business} onChange={(e) => setBusiness(e.target.value)} required maxLength={80} className="field h-11 text-base" />
      </label>
      <div role="radiogroup" aria-label="Tipo de cuenta" className="mt-4 grid grid-cols-2 gap-1 rounded-[10px] bg-[var(--raised)] p-1">
        {(
          [
            ["agente", "Soy agente"],
            ["agencia", "Soy una agencia"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={kind === v}
            onClick={() => setKind(v)}
            className={clsx("press h-10 rounded-[8px] text-[14px] font-semibold", kind === v ? "bg-white text-slate-900" : "text-slate-600 hover:text-slate-900")}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "agencia" && <input type="hidden" name="tipo" value="agencia" />}
      <button type="submit" className="press mt-5 h-[52px] w-full rounded-[10px] bg-brand-600 text-base font-semibold text-white hover:bg-brand-700">
        Crear cuenta gratis
      </button>
    </form>
  );
}
