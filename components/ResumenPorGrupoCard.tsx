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

  // =========================
  // FORMATO
  // =========================
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

  // =========================
  // KPIs GENERALES
  // =========================
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

  // =========================
  // AGRUPACIÓN TIPO PIVOT
  // =========================
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
      <div className="p-5 text-sm text-gray-500">
        Cargando datos...
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-4">
      {/* ========================= */}
      {/* TARJETA IA */}
      {/* ========================= */}
      <AnalisisIACard data={data} />

      {/* ========================= */}
      {/* TARJETA PRINCIPAL */}
      {/* ========================= */}
      <div className="border rounded-xl p-5 bg-white shadow-sm">
        {/* HEADER */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold text-[#003331]">
              Ejecución Presupuestaria
            </h2>
            <p className="text-xs text-gray-500">
              Control financiero institucional por techos presupuestarios
            </p>
          </div>

          <button
            onClick={() => setExpandido(!expandido)}
            className="text-xs px-3 py-1 border rounded-md hover:bg-gray-50"
          >
            {expandido ? "Ocultar detalle" : "Ver detalle"}
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4 text-xs">
          <div className="border rounded-lg p-3">
            <div className="text-gray-500">Permitido</div>
            <div className="font-semibold text-[#003331]">
              {formatMoney(totalPermitido)}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-gray-500">Ejecutado</div>
            <div className="font-semibold text-[#42c172]">
              {formatMoney(totalEjecutado)}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-gray-500">Saldo real</div>
            <div className={getSaldoColor(totalSaldoReal)}>
              {formatMoney(totalSaldoReal)}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-gray-500">Comprometido</div>
            <div className="font-semibold text-slate-700">
              {formatMoney(totalComprometido)}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-gray-500">Saldo proyectado</div>
            <div className={getSaldoColor(totalSaldoProyectado)}>
              {formatMoney(totalSaldoProyectado)}
            </div>
          </div>
        </div>

        {/* RESUMEN PORCENTUAL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-xs">
          <div className="border rounded-lg p-3">
            <div className="text-gray-500">% ejecución real</div>
            <div className={getPercentColor(porcentajeEjecucion)}>
              {porcentajeEjecucion.toFixed(2)}%
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-gray-500">% uso proyectado</div>
            <div className={getPercentColor(porcentajeUsoProyectado)}>
              {porcentajeUsoProyectado.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* BARRA PROYECTADA */}
        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>Uso proyectado del techo</span>
            <span>{porcentajeUsoProyectado.toFixed(2)}%</span>
          </div>

          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full bg-[#42c172]"
              style={{ width: `${porcentajeVisual}%` }}
            />
          </div>
        </div>

        {/* TABLA DINÁMICA */}
        {expandido && (
          <div className="mt-6 border-t pt-4">
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
                <div key={fuente} className="mb-6">
                  <div className="text-xs font-semibold text-[#003331] mb-2">
                    {fuente}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-xs border">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left p-2">Tipo</th>
                          <th className="text-right p-2">Permitido</th>
                          <th className="text-right p-2">Ejecutado</th>
                          <th className="text-right p-2">Saldo real</th>
                          <th className="text-right p-2">Comprometido</th>
                          <th className="text-right p-2">Saldo proyectado</th>
                          <th className="text-right p-2">% real</th>
                          <th className="text-right p-2">% proyectado</th>
                        </tr>
                      </thead>

                      <tbody>
                        {rows.map((r, i) => {
                          return (
                            <tr key={i} className="border-t">
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
                          );
                        })}

                        {/* SUBTOTAL */}
                        <tr className="border-t font-semibold bg-gray-50">
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