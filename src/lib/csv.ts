// CSV compatible con Excel en español: separador ";" y BOM UTF-8 para que respete los acentos.

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  const s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: unknown[][]) {
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}

export function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
