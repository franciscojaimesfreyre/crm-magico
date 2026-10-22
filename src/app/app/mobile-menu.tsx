"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/** Menú del teléfono: una hoja a pantalla completa que se cierra sola al cambiar de pantalla. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <details ref={ref} className="group">
      <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-md text-slate-700 hover:bg-[var(--raised)]" aria-label="Menú">
        <Menu className="size-5" />
      </summary>
      <div className="t-sheet fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[var(--ground)]">
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
          <span className="text-[15px] font-semibold text-slate-900">Menú</span>
          <button
            type="button"
            onClick={() => ref.current && (ref.current.open = false)}
            className="grid size-10 place-items-center rounded-md text-slate-700 hover:bg-[var(--raised)]"
            aria-label="Cerrar menú"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </details>
  );
}
