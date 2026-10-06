// Gráficos de una sola serie en HTML/CSS (server components): columnas y barras horizontales.
// Specs: marcas ≤24px, extremo redondeado 4px y base recta, grilla hairline, tooltip al pasar el mouse,
// etiqueta directa solo en el máximo y tabla de datos accesible.

type Datum = { label: string; value: number; display: string };

const BAR = "#7c3aed"; // brand-600, validado contra la superficie clara

function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const compact = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });

export function ColumnChart({ data, title, height = 200 }: { data: Datum[]; title: string; height?: number }) {
  const top = niceMax(Math.max(...data.map((d) => d.value), 0));
  const maxIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const ticks = [top, top / 2, 0];
  return (
    <figure>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between pb-6 text-right text-[11px] text-slate-400 tabular-nums" style={{ height }}>
          {ticks.map((t) => (
            <span key={t}>{compact.format(t).toLowerCase()}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: height - 24 }} aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="h-px bg-slate-100" />
            ))}
          </div>
          <div className="relative flex items-end" style={{ height: height - 24 }} role="img" aria-label={title}>
            {data.map((d, i) => (
              <div key={d.label} className="group relative flex h-full flex-1 items-end justify-center">
                {/* zona de hover más grande que la marca */}
                <div
                  className="w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                  style={{ height: `${top ? (d.value / top) * 100 : 0}%`, backgroundColor: BAR, minHeight: d.value > 0 ? 2 : 0 }}
                />
                {i === maxIndex && d.value > 0 && (
                  <span className="absolute text-[11px] font-medium whitespace-nowrap text-slate-700" style={{ bottom: `calc(${(d.value / top) * 100}% + 4px)` }}>
                    {d.display}
                  </span>
                )}
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-slate-900 px-2 py-1 text-[11px] whitespace-nowrap text-white shadow group-hover:block">
                  {d.label}: {d.display}
                </div>
              </div>
            ))}
          </div>
          <div className="flex h-6 items-end">
            {data.map((d) => (
              <span key={d.label} className="flex-1 text-center text-[11px] text-slate-500">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <DataTable data={data} />
    </figure>
  );
}

export function BarList({ data, title }: { data: Datum[]; title: string }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (data.length === 0) return <p className="text-sm text-slate-500">Sin datos para el período.</p>;
  return (
    <figure>
      <ul className="space-y-2.5" role="img" aria-label={title}>
        {data.map((d) => (
          <li key={d.label} className="group grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 text-sm">
            <span className="truncate text-slate-600" title={d.label}>
              {d.label}
            </span>
            <div className="flex items-center gap-2">
              <div className="h-5 rounded-r-[4px] group-hover:opacity-80" style={{ width: `${max ? Math.max((d.value / max) * 85, 1) : 0}%`, backgroundColor: BAR }} />
              <span className="text-xs whitespace-nowrap text-slate-700 tabular-nums">{d.display}</span>
            </div>
          </li>
        ))}
      </ul>
      <DataTable data={data} />
    </figure>
  );
}

function DataTable({ data }: { data: Datum[] }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-slate-400 hover:text-slate-600">Ver datos</summary>
      <table className="mt-2 w-full">
        <tbody className="divide-y divide-slate-100">
          {data.map((d) => (
            <tr key={d.label}>
              <td className="py-1 text-slate-600">{d.label}</td>
              <td className="py-1 text-right text-slate-800 tabular-nums">{d.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
