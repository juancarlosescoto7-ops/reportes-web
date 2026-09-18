import { Gauge } from "lucide-react";
import type { ReactNode } from "react";
import type { RespuestaBorrador } from "@/modules/presupuesto/services/borradorPresupuesto";

const money = (value: unknown) => (Number(value) || 0).toLocaleString("es-HN", {
  style: "currency", currency: "HNL", minimumFractionDigits: 2,
});

export default function BorradorPresupuestoLayout({ data, herramientas, children }: {
  data: RespuestaBorrador;
  herramientas?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/60 lg:flex-row">
      <aside aria-label="Panel presupuestario" className="flex max-h-[40vh] shrink-0 flex-col gap-3 overflow-y-auto border-b border-slate-200/80 bg-[#f7f9f8] p-3 lg:max-h-none lg:w-60 lg:border-b-0 lg:border-r">
        {herramientas}
        <section aria-label="Techos disponibles" className="shrink-0 space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Gauge className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />Techos</h2>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200">{data.controlTechos.length}</span>
          </div>
          {data.controlTechos.map((row) => {
            const disponible = Number(row.monto_disponible) || 0;
            const permitido = Number(row.monto_permitido) || 0;
            const uso = permitido > 0 ? Math.min(100, Math.max(0, ((permitido - disponible) / permitido) * 100)) : 0;
            const excedido = disponible < 0;
            return (
              <article key={`${row.fuente}-${row.nivel_aplicacion}-${row.id_nivel}`} className={`rounded-xl border bg-white p-3 shadow-sm ${excedido ? "border-rose-200" : "border-slate-200/80"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-semibold text-slate-800" title={row.fuente}>{row.fuente}</span>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${excedido ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`} title={`${row.nivel_aplicacion} ${row.id_nivel}`}>
                    {row.nivel_aplicacion === "programa" ? "Programa" : "Tipo"} {row.id_nivel}
                  </span>
                </div>
                <div className="mt-3 text-[10px] font-medium text-slate-500">Disponible</div>
                <div className={`mt-0.5 text-base font-bold tracking-tight tabular-nums ${excedido ? "text-rose-700" : "text-[#003331]"}`}>{money(disponible)}</div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={`h-full rounded-full ${excedido ? "bg-rose-500" : "bg-[#2fae68]"}`} style={{ width: `${uso}%` }} /></div>
                <div className="mt-1.5 text-[10px] tabular-nums text-slate-500" title="Techo permitido">de {money(permitido)}</div>
              </article>
            );
          })}
          {!data.controlTechos.length ? <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs text-slate-400">Sin techos</p> : null}
        </section>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">{children}</div>
    </div>
  );
}
