"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui";

/** Checkbox que marca/desmarca todas las casillas "bookingIds" del formulario. */
export function SelectAll({ defaultChecked }: { defaultChecked?: boolean }) {
  return (
    <input
      type="checkbox"
      defaultChecked={defaultChecked}
      className="size-4 rounded border-slate-300"
      title="Seleccionar todo"
      onChange={(e) => {
        const form = e.currentTarget.form;
        form?.querySelectorAll<HTMLInputElement>('input[name="bookingIds"]').forEach((cb) => (cb.checked = e.currentTarget.checked));
      }}
    />
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("secondary")}>
      <Printer className="size-4" /> Imprimir / PDF
    </button>
  );
}
