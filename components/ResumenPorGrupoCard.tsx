"use client";

import { useEffect, useState } from "react";
import {
  obtenerResumenPorGrupo,
  ResumenPorGrupo,
} from "@/services/resumenPorGrupo";

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
  // KPIs
  // =========================
  const totalPermitido = data.reduce(
    (acc, r) => acc + r.MontoPermitido,
    0
  );

  const totalEjecutado = data.reduce(
    (acc, r) => acc + r.MontoEjecutado,
    0
  );

  const porcentajeReal =
    totalPermitido === 0
      ? 0
      : (totalEjecutado / totalPermitido) * 100;

  const porcentajeVisual = Math.min(porcentajeReal, 100);

  // =========================
  // SOLO COLOR PARA % (NO GLOBAL)
  // =========================
  function getPercentColor(p: number) {
    if (p > 100) return "text-red-700 font-semibold";
    if (p >= 90) return "text-orange-600 font-semibold";
    if (p >= 70) return "text-yellow-600 font-semibold";
    return "text-emerald-600 font-medium";
  }

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
    <div className="max-w-5xl">

      <div className="border rounded-xl p-5 bg-white shadow-sm">

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold text-[#003331]">
              Ejecución Presupuestaria
            </h2>
            <p className="text-xs text-gray-500">
              Control financiero institucional
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
        <div className="grid grid-cols-3 gap-3 mt-4 text-xs">

          <div className="border rounded-lg p-3">
            <div className="text-gray-500">Permitido</div>
            <div className="font-semibold text-[#003331]">
              L {totalPermitido.toLocaleString()}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-gray-500">Ejecutado</div>
            <div className="font-semibold text-[#42c172]">
              L {totalEjecutado.toLocaleString()}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-gray-500">% Ejecución</div>
            <div className="font-semibold text-[#003331]">
              {porcentajeReal.toFixed(2)}%
            </div>
          </div>

        </div>

        {/* BARRA */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 h-2 rounded-full">
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

              const porcentajeGrupo =
                subtotalPermitido === 0
                  ? 0
                  : (subtotalEjecutado / subtotalPermitido) * 100;

              return (
                <div key={fuente} className="mb-6">

                  <div className="text-xs font-semibold text-[#003331] mb-2">
                    {fuente}
                  </div>

                  <table className="w-full text-xs border">

                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left p-2">Tipo</th>
                        <th className="text-right p-2">Permitido</th>
                        <th className="text-right p-2">Ejecutado</th>
                        <th className="text-right p-2">% Ejecución</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((r, i) => {
                        const pct =
                          r.MontoPermitido === 0
                            ? 0
                            : (r.MontoEjecutado / r.MontoPermitido) * 100;

                        return (
                          <tr key={i} className="border-t">

                            <td className="p-2">{r.Tipo}</td>

                            <td className="p-2 text-right">
                              {r.MontoPermitido.toLocaleString()}
                            </td>

                            <td className="p-2 text-right">
                              {r.MontoEjecutado.toLocaleString()}
                            </td>

                            {/* 🔥 SOLO ESTA COLUMNA CAMBIA */}
                            <td className={`p-2 text-right ${getPercentColor(pct)}`}>
                              {pct.toFixed(1)}%
                            </td>

                          </tr>
                        );
                      })}

                      {/* SUBTOTAL */}
                      <tr className="border-t font-semibold bg-gray-50">

                        <td className="p-2">Subtotal</td>

                        <td className="p-2 text-right">
                          {subtotalPermitido.toLocaleString()}
                        </td>

                        <td className="p-2 text-right">
                          {subtotalEjecutado.toLocaleString()}
                        </td>

                        <td className={`p-2 text-right ${getPercentColor(porcentajeGrupo)}`}>
                          {porcentajeGrupo.toFixed(1)}%
                        </td>

                      </tr>

                    </tbody>
                  </table>
                </div>
              );
            })}

          </div>
        )}

      </div>
    </div>
  );
}