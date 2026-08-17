import { Calculator, CircleDollarSign, Scale, WalletCards } from "lucide-react";

import type { ReporteOficinaMujer as ReporteOficinaMujerData } from "@/lib/reporte-oficina-mujer";

export default function ReporteOficinaMujer({
  reporte,
}: {
  reporte: ReporteOficinaMujerData;
}) {
  return (
    <div className="space-y-4">
      <header className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Resumen por grupos · distribución interna
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {reporte.grupo}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              El porcentaje ejecutable de cada eje corresponde a su participación
              en el monto vigente total del grupo. Esa proporción distribuye el
              ejecutable general antes de restar lo ejecutado y comprometido.
            </p>
          </div>

          <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
              Nivel usado como eje
            </div>
            <div className="mt-1 font-semibold">{reporte.nivelEje}</div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          icon={WalletCards}
          label="Vigente del grupo"
          value={formatMoney(reporte.montoVigenteGrupo)}
        />
        <Kpi
          icon={CircleDollarSign}
          label="Ejecutable general"
          value={formatMoney(reporte.ejecutableGeneralGrupo)}
          valueClass="text-emerald-700"
        />
        <Kpi
          icon={Calculator}
          label="Ejecutado"
          value={formatMoney(reporte.montoEjecutadoGrupo)}
        />
        <Kpi
          icon={Scale}
          label="Comprometido"
          value={formatMoney(reporte.montoComprometidoGrupo)}
        />
        <Kpi
          icon={CircleDollarSign}
          label="Saldo ejecutable"
          value={formatMoney(reporte.saldoEjecutableGrupo)}
          valueClass={getSaldoClass(reporte.saldoEjecutableGrupo)}
        />
      </section>

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="text-base font-semibold text-slate-950">
            Ejecutable por eje
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Fórmula: (vigente del eje ÷ vigente del grupo) × ejecutable general −
            ejecutado − comprometido.
          </p>
        </div>

        {reporte.ejes.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            No se encontraron renglones presupuestarios asociados a Oficina de la
            Mujer.
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {reporte.ejes.map((eje) => (
                <article
                  key={eje.eje}
                  className="border border-slate-200 bg-white p-3"
                >
                  <h3 className="text-sm font-semibold text-slate-900">
                    {eje.eje}
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Dato
                      label="Vigente"
                      value={formatMoney(eje.montoVigente)}
                    />
                    <Dato
                      label="% ejecutable"
                      value={formatPercent(eje.porcentajeEjecutable)}
                    />
                    <Dato
                      label="Ejecutable asignado"
                      value={formatMoney(eje.montoEjecutable)}
                    />
                    <Dato
                      label="Ejecutado"
                      value={formatMoney(eje.montoEjecutado)}
                    />
                    <Dato
                      label="Comprometido"
                      value={formatMoney(eje.montoComprometido)}
                    />
                    <Dato
                      label="Saldo ejecutable"
                      value={formatMoney(eje.saldoEjecutable)}
                      valueClass={getSaldoClass(eje.saldoEjecutable)}
                    />
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px] text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Eje</th>
                    <th className="px-3 py-3 text-right">Monto vigente</th>
                    <th className="px-3 py-3 text-right">% ejecutable</th>
                    <th className="px-3 py-3 text-right">Ejecutable asignado</th>
                    <th className="px-3 py-3 text-right">Ejecutado</th>
                    <th className="px-3 py-3 text-right">Comprometido</th>
                    <th className="px-4 py-3 text-right">Saldo ejecutable</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.ejes.map((eje) => (
                    <tr key={eje.eje} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {eje.eje}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatMoney(eje.montoVigente)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-700">
                        {formatPercent(eje.porcentajeEjecutable)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                        {formatMoney(eje.montoEjecutable)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatMoney(eje.montoEjecutado)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatMoney(eje.montoComprometido)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${getSaldoClass(
                          eje.saldoEjecutable
                        )}`}
                      >
                        {formatMoney(eje.saldoEjecutable)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-950">
                  <tr>
                    <td className="px-4 py-3">Total del grupo</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatMoney(reporte.montoVigenteGrupo)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatPercent(reporte.ejes.length > 0 ? 100 : 0)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatMoney(reporte.ejecutableGeneralGrupo)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatMoney(reporte.montoEjecutadoGrupo)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatMoney(reporte.montoComprometidoGrupo)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${getSaldoClass(
                        reporte.saldoEjecutableGrupo
                      )}`}
                    >
                      {formatMoney(reporte.saldoEjecutableGrupo)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  valueClass = "text-slate-950",
}: {
  icon: typeof Calculator;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon aria-hidden="true" className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>
      <div className={`mt-3 text-lg font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function Dato({
  label,
  value,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-slate-50 px-2 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-xs font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number) {
  return `${Number(value || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function getSaldoClass(value: number) {
  if (value < 0) return "text-rose-700";
  if (value === 0) return "text-amber-700";
  return "text-emerald-700";
}
