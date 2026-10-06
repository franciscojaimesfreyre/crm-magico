"use client";

import { useRef, useState } from "react";

/** Recuadro para dibujar la firma con mouse o dedo. Guarda un PNG en un input oculto. */
export function SignaturePad() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [value, setValue] = useState("");

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * e.currentTarget.width) / rect.width, y: ((e.clientY - rect.top) * e.currentTarget.height) / rect.height };
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="label mb-0">Dibujá tu firma (opcional)</span>
        <button
          type="button"
          className="text-xs text-slate-500 hover:underline"
          onClick={() => {
            const c = canvas.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setValue("");
          }}
        >
          Borrar
        </button>
      </div>
      <canvas
        ref={canvas}
        width={600}
        height={180}
        className="h-36 w-full touch-none rounded-lg border border-dashed border-slate-300 bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d")!;
          const p = point(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#0f172a";
          const p = point(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          setValue(e.currentTarget.toDataURL("image/png"));
        }}
      />
      <input type="hidden" name="signature" value={value} />
    </div>
  );
}
