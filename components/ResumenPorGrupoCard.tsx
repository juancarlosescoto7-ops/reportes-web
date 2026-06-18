"use client";

import { useEffect, useState } from "react";
import {
  obtenerResumenPorGrupo,
  ResumenPorGrupo,
} from "@/services/resumenPorGrupo";
import AnalisisIACard from "@/components/AnalisisIACard";

export default function ResumenPorGrupoCard() {
  const [data, setData] = useState<ResumenPorGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await obtenerResumenPorGrupo();
      setData(res);
      setLoading(false);
    }

    load();
  }, []);

  function formatMoney(value: number) {
    return `L ${value.toLocaleString("es-HN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function getPercentColor(p: number) {
    if (p > 100) return "text-red-700 font-semibold";
    if (p >= 90) return "text-orange-600 font-semibold";
    if (p >= 70) return "text-yellow-600 font-semibold";
    return "text-emerald-600 font-medium";
  }

  function getSaldoColor(value: number) {
    if (value < 0) return "text-red-700 font-semibold";
    if (value === 0) return "text-orange-600 font-semibold";
    return "text-emerald-700 font-semibold";
  }

  function KpiCard({
    label,
    value,
    className = "text-[#003331]",
  }: {
    label: string;
    value: string;
    className?: string;
  }) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="text-[11px] font-medium text-slate-500">{label}</div>
        <div className={`mt-1 text-sm font-semibold ${className}`}>
          {value}
        </div>
      </div>
    );
  }

  function MetricLine({
    label,
    value,
    className = "text-slate-800",
  }: {
    label: string;
    value: string;
    className?: string;
  }) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className={`text-right text-xs font-semibold ${className}`}>
          {value}
        </span>
      </div>
    );
  }

  const totalPermitido = data.reduce(
    (acc, r) => acc + r.MontoPermitido,
    0
  );

  const totalEjecutado = data.reduce(
    (acc, r) => acc + r.MontoEjecutado,
    0
  );

  const totalSaldoReal = data.reduce(
    (acc, r) => acc + r.SaldoDisponibleReal,
    0
  );

  const totalComprometido = data.reduce(
    (acc, r) => acc + r.MontoComprometido,
    0
  );

  const totalSaldoProyectado = data.reduce(
    (acc, r) => acc + r.SaldoDisponibleProyectado,
    0
  );

  const porcentajeEjecucion =
    totalPermitido === 0
      ? 0
      : (totalEjecutado / totalPermitido) * 100;

  const porcentajeUsoProyectado =
    totalPermitido === 0
      ? 0
      : ((totalEjecutado + totalComprometido) / totalPermitido) * 100;

  const porcentajeVisual = Math.min(porcentajeUsoProyectado, 100);

  const agrupado: Record<string, ResumenPorGrupo[]> = data.reduce(
    (acc, row) => {
      if (!acc[row.Fuente]) acc[row.Fuente] = [];
      acc[row.Fuente].push(row);
      return acc;
    },
    {} as Record<string, ResumenPorGrupo[]>
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Cargando datos...
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl space-y-4">
      <AnalisisIACard data={data} />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#003331]">
              Ejecución Presupuestaria
            </h2>
            <p className="text-xs text-slate-500">
              Control financiero institucional por techos presupuestarios
            </p>
          </div>

          <button
            onClick={() => setExpandido(!expandido)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            {expandido ? "Ocultar detalle" : "Ver detalle"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Permitido"
            value={formatMoney(totalPermitido)}
          />

          <KpiCard
            label="Ejecutado"
            value={formatMoney(totalEjecutado)}
            className="text-[#42c172]"
          />

          <KpiCard
            label="Saldo real"
            value={formatMoney(totalSaldoReal)}
            className={getSaldoColor(totalSaldoReal)}
          />

          <KpiCard
            label="Comprometido"
            value={formatMoney(totalComprometido)}
            className="text-slate-700"
          />

          <KpiCard
            label="Saldo proyectado"
            value={formatMoney(totalSaldoProyectado)}
            className={getSaldoColor(totalSaldoProyectado)}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KpiCard
            label="% ejecución real"
            value={`${porcentajeEjecucion.toFixed(2)}%`}
            className={getPercentColor(porcentajeEjecucion)}
          />

          <KpiCard
            label="% uso proyectado"
            value={`${porcentajeUsoProyectado.toFixed(2)}%`}
            className={getPercentColor(porcentajeUsoProyectado)}
          />
        </div>

        <div className="mt-5">
          <div className="mb-1 flex justify-between text-[11px] text-slate-500">
            <span>Uso proyectado del techo</span>
            <span>{porcentajeUsoProyectado.toFixed(2)}%</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-[#42c172]"
              style={{ width: `${porcentajeVisual}%` }}
            />
          </div>
        </div>

        {expandido && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            {Object.entries(agrupado).map(([fuente, rows]) => {
              const subtotalPermitido = rows.reduce(
                (acc, r) => acc + r.MontoPermitido,
                0
              );

              const subtotalEjecutado = rows.reduce(
                (acc, r) => acc + r.MontoEjecutado,
                0
              );

              const subtotalSaldoReal = rows.reduce(
                (acc, r) => acc + r.SaldoDisponibleReal,
                0
              );

              const subtotalComprometido = rows.reduce(
                (acc, r) => acc + r.MontoComprometido,
                0
              );

              const subtotalSaldoProyectado = rows.reduce(
                (acc, r) => acc + r.SaldoDisponibleProyectado,
                0
              );

              const porcentajeGrupoReal =
                subtotalPermitido === 0
                  ? 0
                  : (subtotalEjecutado / subtotalPermitido) * 100;

              const porcentajeGrupoProyectado =
                subtotalPermitido === 0
                  ? 0
                  : ((subtotalEjecutado + subtotalComprometido) /
                      subtotalPermitido) *
                    100;

              return (
                <div key={fuente} className="mb-6 last:mb-0">
                  <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-[#003331]">
                    {fuente}
                  </div>

                  {/* Vista móvil / vertical */}
                  <div className="space-y-3 md:hidden">
                    {rows.map((r, i) => (
                      <div
                        key={`${fuente}-${r.Tipo}-${i}`}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="mb-2 text-sm font-semibold text-slate-800">
                          {r.Tipo}
                        </div>

                        <MetricLine
                          label="Permitido"
                          value={formatMoney(r.MontoPermitido)}
                        />

                        <MetricLine
                          label="Ejecutado"
                          value={formatMoney(r.MontoEjecutado)}
                        />

                        <MetricLine
                          label="Saldo real"
                          value={formatMoney(r.SaldoDisponibleReal)}
                          className={getSaldoColor(r.SaldoDisponibleReal)}
                        />

                        <MetricLine
                          label="Comprometido"
                          value={formatMoney(r.MontoComprometido)}
                        />

                        <MetricLine
                          label="Saldo proyectado"
                          value={formatMoney(r.SaldoDisponibleProyectado)}
                          className={getSaldoColor(
                            r.SaldoDisponibleProyectado
                          )}
                        />

                        <MetricLine
                          label="% real"
                          value={`${r.PorcentajeEjecutado.toFixed(1)}%`}
                          className={getPercentColor(
                            r.PorcentajeEjecutado
                          )}
                        />

                        <MetricLine
                          label="% proyectado"
                          value={`${r.PorcentajeUsoProyectado.toFixed(1)}%`}
                          className={getPercentColor(
                            r.PorcentajeUsoProyectado
                          )}
                        />
                      </div>
                    ))}

                    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3">
                      <div className="mb-2 text-sm font-bold text-[#003331]">
                        Subtotal
                      </div>

                      <MetricLine
                        label="Permitido"
                        value={formatMoney(subtotalPermitido)}
                      />

                      <MetricLine
                        label="Ejecutado"
                        value={formatMoney(subtotalEjecutado)}
                      />

                      <MetricLine
                        label="Saldo real"
                        value={formatMoney(subtotalSaldoReal)}
                        className={getSaldoColor(subtotalSaldoReal)}
                      />

                      <MetricLine
                        label="Comprometido"
                        value={formatMoney(subtotalComprometido)}
                      />

                      <MetricLine
                        label="Saldo proyectado"
                        value={formatMoney(subtotalSaldoProyectado)}
                        className={getSaldoColor(subtotalSaldoProyectado)}
                      />

                      <MetricLine
                        label="% real"
                        value={`${porcentajeGrupoReal.toFixed(1)}%`}
                        className={getPercentColor(porcentajeGrupoReal)}
                      />

                      <MetricLine
                        label="% proyectado"
                        value={`${porcentajeGrupoProyectado.toFixed(1)}%`}
                        className={getPercentColor(
                          porcentajeGrupoProyectado
                        )}
                      />
                    </div>
                  </div>

                  {/* Vista escritorio / tabla */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[980px] border text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="p-2 text-left">Tipo</th>
                          <th className="p-2 text-right">Permitido</th>
                          <th className="p-2 text-right">Ejecutado</th>
                          <th className="p-2 text-right">Saldo real</th>
                          <th className="p-2 text-right">Comprometido</th>
                          <th className="p-2 text-right">
                            Saldo proyectado
                          </th>
                          <th className="p-2 text-right">% real</th>
                          <th className="p-2 text-right">% proyectado</th>
                        </tr>
                      </thead>

                      <tbody>
                        {rows.map((r, i) => (
                          <tr
                            key={`${fuente}-${r.Tipo}-${i}`}
                            className="border-t"
                          >
                            <td className="p-2">{r.Tipo}</td>

                            <td className="p-2 text-right">
                              {formatMoney(r.MontoPermitido)}
                            </td>

                            <td className="p-2 text-right">
                              {formatMoney(r.MontoEjecutado)}
                            </td>

                            <td
                              className={`p-2 text-right ${getSaldoColor(
                                r.SaldoDisponibleReal
                              )}`}
                            >
                              {formatMoney(r.SaldoDisponibleReal)}
                            </td>

                            <td className="p-2 text-right">
                              {formatMoney(r.MontoComprometido)}
                            </td>

                            <td
                              className={`p-2 text-right ${getSaldoColor(
                                r.SaldoDisponibleProyectado
                              )}`}
                            >
                              {formatMoney(r.SaldoDisponibleProyectado)}
                            </td>

                            <td
                              className={`p-2 text-right ${getPercentColor(
                                r.PorcentajeEjecutado
                              )}`}
                            >
                              {r.PorcentajeEjecutado.toFixed(1)}%
                            </td>

                            <td
                              className={`p-2 text-right ${getPercentColor(
                                r.PorcentajeUsoProyectado
                              )}`}
                            >
                              {r.PorcentajeUsoProyectado.toFixed(1)}%
                            </td>
                          </tr>
                        ))}

                        <tr className="border-t bg-slate-50 font-semibold">
                          <td className="p-2">Subtotal</td>

                          <td className="p-2 text-right">
                            {formatMoney(subtotalPermitido)}
                          </td>

                          <td className="p-2 text-right">
                            {formatMoney(subtotalEjecutado)}
                          </td>

                          <td
                            className={`p-2 text-right ${getSaldoColor(
                              subtotalSaldoReal
                            )}`}
                          >
                            {formatMoney(subtotalSaldoReal)}
                          </td>

                          <td className="p-2 text-right">
                            {formatMoney(subtotalComprometido)}
                          </td>

                          <td
                            className={`p-2 text-right ${getSaldoColor(
                              subtotalSaldoProyectado
                            )}`}
                          >
                            {formatMoney(subtotalSaldoProyectado)}
                          </td>

                          <td
                            className={`p-2 text-right ${getPercentColor(
                              porcentajeGrupoReal
                            )}`}
                          >
                            {porcentajeGrupoReal.toFixed(1)}%
                          </td>

                          <td
                            className={`p-2 text-right ${getPercentColor(
                              porcentajeGrupoProyectado
                            )}`}
                          >
                            {porcentajeGrupoProyectado.toFixed(1)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}